# Donee — Project Reference

## What It Is

Donee is a full-stack collaborative task tracker for small dev teams. Teams manage projects, assign tasks, track status, and mention teammates in notes. Built for fast iteration — no bloat.

## Tech Stack

- **Next.js 15** App Router (JavaScript, no TypeScript)
- **Supabase** — Postgres + Row Level Security + Realtime + Edge Functions
- **Tailwind CSS v3** — utility-first styling
- **Radix UI** — headless primitives (Dialog, Dropdown, Popover, Tabs, Tooltip)
- **React Query v5** — server state caching, optimistic updates
- **Recharts** — bar charts
- **date-fns v3** — date formatting
- **lucide-react** — icons
- **Dark mode** — ThemeProvider + topbar toggle (persisted locally)

## User Roles

| Role          | Abilities                                                          |
| ------------- | ------------------------------------------------------------------ |
| `developer`   | Add tasks, edit own tasks (assigned or created)                    |
| `pm`          | Everything developer + assign tasks + manage own projects          |
| `super_admin` | Full access: all tasks, all projects, user management, admin panel |

Role is stored in `profiles.role`. Google OAuth auto-creates profile via DB trigger.

## Pages

| Route                     | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `/`                       | Login (Google OAuth only)                           |
| `/workspace`              | Workspace onboarding (create/join/switch)           |
| `/dashboard`              | Overview: stat cards, 14-day chart, project grid    |
| `/dashboard/tasks`        | All tasks: sortable table with filters, task drawer |
| `/dashboard/project/[id]` | Project tasks with project header                   |
| `/admin`                  | Super admin: user roles, project CRUD               |

## Data Model

```
profiles         ← auth.users (auto-created by trigger)
  id, full_name, avatar_url, email, role

workspaces
  id, name, created_by, created_at

workspace_members
  id, workspace_id, user_id, role, joined_at

workspace_invitations
  id, workspace_id, email, invite_code, invited_by, created_at,
  expires_at, accepted_at, accepted_by

projects
  id, workspace_id, name, description, color, pm_id, created_by, is_archived

project_members
  id, workspace_id, project_id, user_id, joined_at   ← who's in what project

tasks
  id, workspace_id, project_id, title, description
  priority: lowest|low|medium|high|critical
  status:   backlog|in_progress|estimation|review|
            done_in_staging|waiting_for_confirmation|paused|done
  assigned_to, created_by, estimation (text), url, updated_at

task_notes
  id, workspace_id, task_id, author_id, content, mentions (uuid[])
  ← @mention in content triggers notification (via DB trigger)

notifications
  id, workspace_id, user_id, task_id, type (task_assigned|note_mention|task_created|workspace_invite), message, is_read
  ← realtime enabled, drives bell icon badge
```

## Key Component Interactions

```
DashboardLayout (server)
  → fetches profile + projects (for sidebar)
  → renders Sidebar + Topbar + {children}

TasksPageClient (client)
  → React Query['tasks'] with initialData from server
  → filters client-side (search, status, priority, assignee, date range)
  → TaskTable → row click → TaskDrawer (slide-in panel)
  → TaskTable → inline status select → optimistic update
  → "Add Task" → AddTaskModal (2-step Radix Dialog)

TaskDrawer
  → React Query['notes', taskId] for notes thread
  → EditableField components for inline editing
  → NoteInput with @mention autocomplete (dropdown from projectMembers)
  → mutations: updateTask, addNote

NotificationDropdown (Topbar)
  → React Query['notifications', userId], 60s refetch + Realtime subscription
  → click → markRead + navigate to /dashboard/tasks?task={taskId}
```

## Workspace Scoping

- Current workspace is stored in an HTTP-only cookie (`donee_workspace_id`).
- Middleware redirects authenticated users to `/workspace` if no cookie is set.
- Dashboard/admin/tasks/project pages filter by `workspace_id` (or derive it via joins) so data is isolated per workspace.

## Supabase FK Aliases Used in Queries

Required when a table has multiple FKs to the same target:

```js
profiles!tasks_assigned_to_fkey    // tasks.assigned_to → profiles
profiles!tasks_created_by_fkey     // tasks.created_by → profiles
profiles!projects_pm_id_fkey       // projects.pm_id → profiles
profiles!task_notes_author_id_fkey // task_notes.author_id → profiles
```

## Authentication

- Google OAuth via Supabase Auth
- Flow: Login → Google → `/auth/callback?code=...` → exchange code → set session → `/dashboard`
- Middleware (`middleware.js`) guards all `/dashboard/*` and `/admin/*` routes
- Dashboard layout also guards (double-check after middleware)

## Notifications System

1. User assigns task → DB trigger `handle_task_insert_notification` creates notification row
2. User changes `assigned_to` → DB trigger `handle_task_update_notification` creates notification
3. User writes note with `@Name` → DB trigger `handle_task_note_mentions` parses mentions, creates notification for each mentioned user
4. Frontend subscribes via Supabase Realtime → invalidates React Query → bell badge updates

## Edge Function

`supabase/functions/send-notification-email/index.ts` — Resend API email sender, triggered by Postgres Webhook on `notifications` INSERT. Not critical for app function.

## File Conventions

- `page.js` = Server Component (fetches data, passes as props to client)
- `*Client.js` = Client Component (React Query, useState, interactivity)
- `components/ui/` = pure presentational components (no data fetching)
- `components/tasks/` = task-specific feature components
- `components/dashboard/` = dashboard-specific feature components
- `components/admin/` = admin panel components
- `lib/` = shared utilities, no React

## Tests

Location: `__tests__/`  
Framework: Vitest + @testing-library/react + jsdom  
Covers: `lib/utils.js`, `lib/permissions.js`, `StatusTag`, `PriorityTag`  
Run: `npm run test`

## Setup Checklist (First Time)

1. Copy `.env.local.example` → `.env.local`, fill Supabase URL + anon key
2. Run `supabase/migrations/001_init.sql` in Supabase SQL editor
3. Enable Google OAuth in Supabase Dashboard → Auth → Providers → Google
4. Set redirect URL in Supabase: `http://localhost:3000/auth/callback`
5. `npm run dev`
6. First user to sign up should be manually promoted to `super_admin` in Supabase table editor
