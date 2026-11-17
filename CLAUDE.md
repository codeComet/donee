## Prompt Quality Check

Before starting any task, briefly review the request:

- If the goal, context, or expected output is unclear, state what's missing and ask one clarifying question before proceeding.
- If the prompt is clear, confirm your understanding in one sentence and proceed.
- Never refuse to attempt a task due to vagueness — always make a reasonable attempt.
- Give the prompter feedback about the quality of their prompt


# Donee — Task Tracker

Full-stack project management / task tracker. Next.js 15.3 (App Router, JavaScript, no TypeScript) + Supabase (Postgres + RLS + Realtime + Edge Functions) + Tailwind CSS + Radix UI + React Query v5.

## Environment Setup

Copy `.env.local.example` → `.env.local` and fill:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Run SQL migrations in Supabase SQL editor: `supabase/migrations/` (in order)  
Auth is **email/password** (Email provider in Supabase Dashboard → Auth → Providers). Google OAuth is no longer used by the UI.  
Supabase Dashboard → Auth → URL Configuration → Redirect URLs must include `https://<app-domain>/auth/callback**` (and `http://localhost:3000/auth/callback**`) — required for email confirmation and password-reset links.

## Commands

```bash
npm run dev          # Start dev server (loads .env.dev.local)
npm run dev:prod     # Start dev server against prod Supabase (loads .env.prod.local)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (once)
npm run test:watch   # Vitest watch
npm run test:coverage
```

## Stack & Key Libraries

| Concern       | Library                                             |
| ------------- | --------------------------------------------------- |
| Framework     | Next.js 15 App Router                               |
| DB / Auth     | Supabase (@supabase/ssr + @supabase/supabase-js)    |
| Styling       | Tailwind CSS v3 + globals.css                       |
| UI Primitives | Radix UI (Dialog, Dropdown, Popover, Tabs, Tooltip) |
| Server state  | @tanstack/react-query v5                            |
| Icons         | lucide-react                                        |
| Charts        | recharts                                            |
| Dates         | date-fns v3                                         |
| Class merging | clsx + tailwind-merge (via `cn()`)                  |

## Project Structure

```
app/
  layout.js                   Root layout (QueryProvider)
  page.js                     Login page: email/password sign in + sign up toggle
  globals.css
  auth/callback/route.js      Code exchange (email confirm / recovery) → `next` param (default /dashboard)
  forgot-password/page.js     Sends reset email (resetPasswordForEmail → /auth/callback?next=/reset-password)
  reset-password/page.js      Set new password (updateUser) → /dashboard
  dashboard/
    layout.js                 Guard + fetch profile/projects → Sidebar+Topbar
    page.js                   Dashboard overview (stats, chart, project grid)
    tasks/
      page.js                 Server: fetch tasks/projects/users
      TasksPageClient.js      Client: filters, table, drawer, add modal
    project/[id]/
      page.js                 Server: fetch project+members+tasks+users
      ProjectPageClient.js    Client: project header, filters, table, drawer
  admin/
    layout.js                 Guard: super_admin only
    page.js                   Server: fetch all users+projects
    AdminClient.js            Tabs: UsersTab, ProjectsTab
  workspace/
    page.js                   Server: list memberships/workspaces → onboarding UI
    WorkspaceOnboarding.js    Client: create/join/switch workspace
    actions.js                Server actions: create/join/switch, set workspace cookie

components/
  providers/QueryProvider.js  React Query client (staleTime=60s, no refetchOnFocus)
  auth/AuthLayout.js          Shared shell for login/forgot/reset + AuthAlert, AuthSubmitButton, input classes
  layout/
    Sidebar.js                Nav (collapse, mobile overlay, projects list, admin link)
    Topbar.js                 Breadcrumbs, NotificationDropdown, user dropdown + sign out
  ui/
    Avatar.js                 Image or colored-initials circle (xs/sm/md/lg)
    Badge.js                  Project color badge (ProjectBadge)
    StatusTag.js              8 statuses — exports statusConfig
    PriorityTag.js            5 priorities — exports priorityConfig
    SkeletonLoader.js         Skeleton, TableRowSkeleton, CardSkeleton, TaskTableSkeleton
    NotificationDropdown.js   Bell + unread count, real-time, mark read
    RichTextEditor.js         TipTap editor (bold/italic/lists, @mentions, image paste/upload);
                              `onPasteImages` routes pasted images to the caller instead of inserting
  tasks/
    TaskTable.js              Sortable table, inline status select, optimistic updates, delete
    TaskFilters.js            Search, multi-select (project/status/priority/assignee), date range
    TaskDrawer.js             Slide-in panel: editable fields, @mention notes thread
    AddTaskModal.js           2-step Radix Dialog (title+project+rich description+screenshots → priority+status+assignee+est)
    ScreenshotPicker.js       Multi-image picker: upload, drag & drop, paste, screen capture (getDisplayMedia)
  dashboard/
    StatCards.js              4 stat cards (server props)
    TaskChart.js              Recharts bar chart: created vs completed, last 14 days
    ProjectGrid.js            Project cards with task counts by status
  admin/
    UsersTab.js               Users table, role select mutation
    ProjectsTab.js            Projects table + ProjectFormModal (create/edit/archive)

lib/
  supabase.js                 createClient() browser | createServerSideClient(cookieStore) server
  workspace.js                WORKSPACE_COOKIE + getWorkspaceId(cookieStore)
  utils.js                    cn(), getInitials(name), truncate(str, n=60)
  permissions.js              ROLES const + helper fns (optionally accept workspace member)
  notifications.js            fetchUnread, markRead, markAllRead, subscribeToNotifications
  screenshots.js              validateScreenshot, toScreenshot, attachScreenshotsAsNote (upload + one task note)

chrome-extension/             Separate Vite + React app (see chrome-extension/SETUP.md)
  src/background/service-worker.js  Email/password sign in, token refresh, sign out (REST calls)
  src/popup/pages/AddTaskPage.jsx   Add task: TipTap description + screenshots (tab capture/upload/paste)
  src/popup/components/             RichTextEditor.jsx, ScreenshotPicker.jsx, WorkspacePicker.jsx, …

supabase/
  migrations/001_init.sql     Schema: profiles, projects, project_members, tasks, task_notes, notifications
  migrations/002_workspaces.sql  Workspaces tables + workspace_id on core entities + RLS
  migrations/014_disable_auto_join_workspace.sql  New users do not auto-join; onboarding is create/join
  migrations/004_fix_workspace_rls_recursion.sql  is_workspace_member() helper + non-recursive workspace RLS
  migrations/013_grant_workspace_tables.sql  Grants for workspace tables (Data API / PostgREST)
  migrations/022_multi_pm_per_project.sql    project_managers join table + RLS + data migration from pm_id
```

## Database Schema (Workspace-aware)

All tables have RLS enabled.

- **profiles** — mirrors auth.users (id, full_name, avatar_url, email, role)  
  role enum: `developer` (default) | `pm` | `super_admin`

- **workspaces** — (id, name, created_by, created_at)
- **workspace_members** — (id, workspace_id, user_id, role, joined_at)
- **workspace_invitations** — (id, workspace_id, email, invite_code, invited_by, created_at, expires_at, accepted_at, accepted_by)

- **projects** — (id, name, description, color hex, pm_id→profiles, created_by, created_at, is_archived)  
  `pm_id` kept for FK alias compat but no longer authoritative — use `project_managers` table instead

- **project_managers** — (id, project_id, user_id, assigned_by, assigned_at) — UNIQUE(project_id, user_id)  
  Join table replacing single `pm_id`. Multiple PMs per project. RLS uses `get_project_workspace_id()` SECURITY DEFINER to avoid circular dependency with `projects_select`.

- **project_members** — (id, project_id, user_id, joined_at) — UNIQUE(project_id, user_id)

- **tasks** — (id, project_id, title, description (HTML), priority, status, assigned_to, created_by, estimation, url, deadline, created_at, updated_at)  
  priority: `lowest|low|medium|high|critical`  
  status: `backlog|in_progress|estimation|review|done_in_staging|waiting_for_confirmation|paused|done`

DB Triggers:

- `handle_new_user` — auto-creates profile on auth.users INSERT (`full_name` from sign-up metadata, falls back to email prefix)
- `handle_task_updated_at` — updates tasks.updated_at on UPDATE
- `handle_task_note_mentions` — parses @name from note content, creates notification rows, populates mentions[]
- `handle_task_insert_notification` — creates task_assigned notification on INSERT if assigned_to set
- `handle_task_update_notification` — creates task_assigned notification when assigned_to changes

Realtime enabled on: `notifications`, `tasks`

## Auth Flow

1. Sign in: `supabase.auth.signInWithPassword({ email, password })` → `/dashboard`
2. Sign up: `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: /auth/callback } })`  
   → session immediately, or "check your email" if confirmation is enabled
3. Forgot password: `/forgot-password` → `resetPasswordForEmail(email, { redirectTo: /auth/callback?next=/reset-password })`  
   → `/reset-password` → `updateUser({ password })`. PKCE: the link must be opened in the same browser that requested it.
4. `/auth/callback` → `exchangeCodeForSession(code)` → `next`. Users without a workspace go to `/workspace`, except when `next=/reset-password`.
5. Middleware guards `/dashboard/*` and `/admin/*`; redirects authenticated users away from `/`

## Task Screenshots

- Add Task (web modal + extension) collects multiple screenshots; on create they're uploaded to the public
  `task-images` bucket (`<user_id>/<timestamp>-<i>.<ext>`, PNG/JPEG/GIF/WebP, ≤5 MB each) and inserted as **one
  `task_notes` row** whose content is `<img>` tags (use `attachScreenshotsAsNote` from `@/lib/screenshots`).
- If the task is created but the upload fails, the UI reports a partial failure instead of retrying (avoids duplicate tasks).
- Note/description HTML is rendered via `dangerouslySetInnerHTML` inside `.rich-text` (styles in `globals.css`) —
  **always** pass it through `sanitizeRichText()` from `@/lib/sanitize` (stored-XSS guard); use `safeHref()` for user URLs.

## Workspaces

- Current workspace selection is stored in an HTTP-only cookie: `donee_workspace_id`.
- If an authenticated user hits `/dashboard` or `/admin` without the cookie, middleware redirects to `/workspace`.
- Data is scoped by `workspace_id` across projects, tasks, task_notes, notifications, and project_members.

## Supabase Query Patterns

```js
// Server component
import { cookies } from "next/headers";
import { createServerSideClient } from "@/lib/supabase";
const cookieStore = await cookies();
const supabase = createServerSideClient(cookieStore)
  // FK alias syntax (disambiguate multiple FKs)
  .select(
    "*, assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url)",
  )
  .select("*, pm:profiles!projects_pm_id_fkey(id, full_name, avatar_url)")
  .select(
    "*, author:profiles!task_notes_author_id_fkey(id, full_name, avatar_url)",
  )
  .select(
    "*, members:project_members(user:profiles(id, full_name, avatar_url))",
  )
  // project_managers has two FKs to profiles (user_id + assigned_by) — must disambiguate
  .select(
    "*, project_managers(user:profiles!project_managers_user_id_fkey(id, full_name, avatar_url))",
  );

// Count query (HEAD)
supabase
  .from("tasks")
  .select("*", { count: "exact", head: true })
  .eq("status", "done");
```

## React Query Patterns

```js
// Server initial data → client hydration
const { data } = useQuery({
  queryKey: ['tasks'],           // or ['tasks', 'project', projectId]
  queryFn: fetchTasks,
  initialData: serverFetchedData,
  staleTime: 30_000,
})

// Optimistic mutation with rollback
const mutation = useMutation({
  mutationFn: async (payload) => { /* supabase update */ },
  onMutate: async (newData) => {
    await qc.cancelQueries({ queryKey: ['tasks'] })
    const prev = qc.getQueriesData({ queryKey: ['tasks'] })
    qc.setQueriesData({ queryKey: ['tasks'] }, (old) => /* update */)
    return { prev }
  },
  onError: (err, _, ctx) => {
    // Restore each cached query individually
    ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
  },
  onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
})
```

## Permissions

```js
import {
  isSuperAdmin,
  isPM,
  canEditTask,
  canAssignTask,
  canManageProject,
  canAccessAdmin,
} from "@/lib/permissions";
// All functions take profile object (from profiles table)
// canEditTask(profile, task) — super_admin/pm always; dev if assigned_to or created_by
// canManageProject(profile, project) — checks project.project_managers array; falls back to pm_id
```

## Role Hierarchy

`super_admin` > `pm` > `developer`

- super_admin: full access to everything
- pm: manage own projects, assign tasks
- developer: edit tasks assigned to them / created by them

## Notifications

Real-time via Supabase Realtime:

```js
import { subscribeToNotifications } from "@/lib/notifications";
const unsub = subscribeToNotifications(userId, () => {
  /* invalidate query */
});
```

## Styling Conventions

- `cn()` from `@/lib/utils` for conditional classes (clsx + tailwind-merge)
- Custom utilities in `globals.css`: `.skeleton` (shimmer), `.scrollbar-thin`
- Custom animations in `tailwind.config.js`: `animate-fade-in`, `animate-slide-in-right`, `animate-shimmer`
- Colors: indigo-600 primary, slate-\* neutral, status/priority colors match StatusTag/PriorityTag configs

## Supabase CLI

- Installed via Homebrew; linked to **prod** (`pfprpwhbdqebhenbqgby`, "Donee Prod"). Dev project: `iszczjmhltjzphcsrfof` ("Donee Dev", same account, recreated 2026-11-03; old `baeeayzyvdwtofztewcr` is gone). Target it with `--remote=iszczjmhltjzphcsrfof`.
- Run SQL: `supabase db query --linked "select …"` (read-only queries freely; confirm before writes on prod).
- Migration files use `NNN_name.sql`, not the CLI's timestamp format, and were applied by hand — **do not run `supabase db push`**.
- The `notifications` INSERT trigger calls the `send-notification-email` webhook (real emails). Disable user triggers
  inside the transaction when doing bulk data fixes that would insert notifications.

## Git / Deploy

- Work on `dev`, open a PR `dev → main`. Vercel deploys previews from `dev` and production from `main`.
- Commit style: gitmoji prefix (`:sparkles:`, `:bug:`, `:lipstick:`, `:memo:`).

## Path Alias

`@/` → project root (configured in `next.config.js` via Next.js default)

## Known Limitations / Not Implemented

- No error.js / not-found.js pages (only `notFound()` redirect)
- No toast notifications for mutation errors
- Dashboard sidebar projects list is server-fetched (doesn't update on new project without refresh)
- Extension Add Task filters PM projects by legacy `projects.pm_id`, not `project_managers`
- Uploaded screenshots are never deleted from storage when a task/note is deleted
- Dark mode is supported (ThemeProvider + topbar toggle)
  