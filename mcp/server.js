#!/usr/bin/env node
// Donee MCP server (stdio). Signs in as the user, so Supabase RLS limits every call
// to exactly what that user can see/do in the web app.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const STATUSES = ["backlog", "in_progress", "estimation", "review", "done_in_staging", "waiting_for_confirmation", "paused", "done"];
const PRIORITIES = ["lowest", "low", "medium", "high", "critical"];

export const htmlToText = (html) =>
  (html ?? "")
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "[image: $1]")
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const textToHtml = (text) =>
  text.split(/\n{2,}/).map((p) =>
    `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`).join("");

async function main() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, DONEE_EMAIL, DONEE_PASSWORD, DONEE_WORKSPACE_ID } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !DONEE_EMAIL || !DONEE_PASSWORD) {
    console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY, DONEE_EMAIL, DONEE_PASSWORD");
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: DONEE_EMAIL, password: DONEE_PASSWORD });
  if (authErr) { console.error("Sign-in failed:", authErr.message); process.exit(1); }
  const me = auth.user.id;

  const { data: memberships, error: wsErr } = await sb
    .from("workspace_members").select("role, workspace:workspaces(id, name)").eq("user_id", me);
  if (wsErr) throw wsErr;
  const ws = DONEE_WORKSPACE_ID ?? memberships[0]?.workspace?.id;
  if (!ws) { console.error("User has no workspace"); process.exit(1); }

  const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
  const run = (fn) => async (args) => {
    try { return ok(await fn(args ?? {})); }
    catch (e) { return { isError: true, content: [{ type: "text", text: e.message ?? String(e) }] }; }
  };
  const must = ({ data, error }) => { if (error) throw error; return data; };
  const TASK_SELECT = "id, title, status, priority, deadline, estimation, url, created_at, updated_at, project:projects(id, name), assignee:profiles!tasks_assigned_to_fkey(id, full_name), creator:profiles!tasks_created_by_fkey(id, full_name)";

  const server = new McpServer({ name: "donee", version: "0.1.0" });

  server.registerTool("whoami", {
    description: "Current user profile, their workspaces, and which workspace this server is scoped to.",
  }, run(async () => ({
    profile: must(await sb.from("profiles").select("id, full_name, email, role").eq("id", me).single()),
    workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role })),
    active_workspace_id: ws,
  })));

  server.registerTool("list_projects", {
    description: "List non-archived projects in the workspace.",
  }, run(async () => must(await sb.from("projects")
    .select("id, name, description, color").eq("workspace_id", ws).eq("is_archived", false).order("name"))));

  server.registerTool("list_members", {
    description: "List workspace members (use their ids to assign tasks).",
  }, run(async () => must(await sb.from("workspace_members")
    .select("role, user:profiles(id, full_name, email)").eq("workspace_id", ws))));

  server.registerTool("list_tasks", {
    description: "List tasks, newest-updated first. Filters are optional. assigned_to accepts a user id or 'me'.",
    inputSchema: {
      project_id: z.uuid().optional(),
      status: z.array(z.enum(STATUSES)).optional(),
      priority: z.array(z.enum(PRIORITIES)).optional(),
      assigned_to: z.string().optional(),
      search: z.string().optional().describe("Substring match on title"),
      limit: z.number().int().min(1).max(200).default(50),
    },
  }, run(async ({ project_id, status, priority, assigned_to, search, limit = 50 }) => {
    let q = sb.from("tasks").select(TASK_SELECT).eq("workspace_id", ws).order("updated_at", { ascending: false }).limit(limit);
    if (project_id) q = q.eq("project_id", project_id);
    if (status?.length) q = q.in("status", status);
    if (priority?.length) q = q.in("priority", priority);
    if (assigned_to) q = q.eq("assigned_to", assigned_to === "me" ? me : assigned_to);
    if (search) q = q.ilike("title", `%${search.replace(/[%_]/g, "\\$&")}%`);
    return must(await q);
  }));

  server.registerTool("get_task", {
    description: "Full task details including description and all comments.",
    inputSchema: { task_id: z.uuid() },
  }, run(async ({ task_id }) => {
    const task = must(await sb.from("tasks").select(`${TASK_SELECT}, description`).eq("id", task_id).single());
    const notes = must(await sb.from("task_notes")
      .select("id, content, created_at, author:profiles!task_notes_author_id_fkey(id, full_name)")
      .eq("task_id", task_id).order("created_at"));
    return {
      ...task,
      description: htmlToText(task.description),
      comments: notes.map((n) => ({ ...n, content: htmlToText(n.content) })),
    };
  }));

  server.registerTool("recent_comments", {
    description: "Comments posted across the workspace since a given time (default: last 24h).",
    inputSchema: {
      since: z.iso.datetime({ offset: true }).optional().describe("ISO timestamp"),
      limit: z.number().int().min(1).max(200).default(50),
    },
  }, run(async ({ since, limit = 50 }) => {
    const from = since ?? new Date(Date.now() - 864e5).toISOString();
    const notes = must(await sb.from("task_notes")
      .select("id, content, created_at, task:tasks(id, title), author:profiles!task_notes_author_id_fkey(id, full_name)")
      .eq("workspace_id", ws).gte("created_at", from).order("created_at", { ascending: false }).limit(limit));
    return notes.map((n) => ({ ...n, content: htmlToText(n.content) }));
  }));

  server.registerTool("list_notifications", {
    description: "Your notifications (assignments, @mentions, new tasks). Unread only by default.",
    inputSchema: { include_read: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(30) },
  }, run(async ({ include_read = false, limit = 30 }) => {
    let q = sb.from("notifications").select("id, type, message, is_read, created_at, task:tasks(id, title)")
      .eq("user_id", me).order("created_at", { ascending: false }).limit(limit);
    if (!include_read) q = q.eq("is_read", false);
    return must(await q);
  }));

  server.registerTool("mark_notifications_read", {
    description: "Mark notifications as read. Omit ids to mark all as read.",
    inputSchema: { ids: z.array(z.uuid()).optional() },
  }, run(async ({ ids }) => {
    let q = sb.from("notifications").update({ is_read: true }).eq("user_id", me).eq("is_read", false);
    if (ids?.length) q = q.in("id", ids);
    must(await q);
    return { ok: true };
  }));

  server.registerTool("create_task", {
    description: "Create a task in a project. Description is plain text.",
    inputSchema: {
      project_id: z.uuid(),
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      status: z.enum(STATUSES).default("backlog"),
      priority: z.enum(PRIORITIES).optional(),
      assigned_to: z.uuid().optional(),
      deadline: z.iso.date().optional().describe("YYYY-MM-DD"),
      estimation: z.string().optional(),
      url: z.url().optional(),
    },
  }, run(async ({ description, ...rest }) => must(await sb.from("tasks")
    .insert({ ...rest, description: description ? textToHtml(description) : null, created_by: me })
    .select(TASK_SELECT).single())));

  server.registerTool("update_task", {
    description: "Update task fields. Only pass fields to change. Developers can only change some fields (enforced by the database).",
    inputSchema: {
      task_id: z.uuid(),
      title: z.string().min(1).max(500).optional(),
      status: z.enum(STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      assigned_to: z.uuid().nullable().optional(),
      deadline: z.iso.date().nullable().optional(),
      estimation: z.string().nullable().optional(),
      url: z.url().nullable().optional(),
    },
  }, run(async ({ task_id, ...fields }) => {
    const rows = must(await sb.from("tasks").update(fields).eq("id", task_id).select(TASK_SELECT));
    if (!rows.length) throw new Error("Task not found or you lack permission to update it");
    return rows[0];
  }));

  server.registerTool("add_comment", {
    description: "Post a comment (note) on a task. Plain text; @Full Name mentions notify that user.",
    inputSchema: { task_id: z.uuid(), text: z.string().min(1).max(10000) },
  }, run(async ({ task_id, text }) => must(await sb.from("task_notes")
    .insert({ task_id, author_id: me, content: textToHtml(text) }).select("id, created_at").single())));

  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
