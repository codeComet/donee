# Donee — Task Tracker

A production-ready, full-stack task tracker for modern teams. Built with Next.js 15 (App Router), Supabase, Tailwind CSS, and shadcn/Radix UI primitives.

---

## Features

- **Email/password auth** — Sign in, sign up, and forgot/reset password
- **Workspaces** — Multi-workspace support with onboarding, switching, and invite codes
- **Role-based access control** — `super_admin`, `pm`, `developer`
- **Projects** — Color-coded, with PM assignment and member avatars
- **Task management** — Priority, status, assignment, estimation, deadline, URL attachment
- **Rich-text descriptions** — TipTap editor with bold/italic/lists and @mentions
- **Screenshots on task creation** — Upload, drag & drop, paste or capture multiple screenshots; attached as a task note
- **Task drawer** — Slide-in side panel with inline editing and notes thread
- **@mention autocomplete** — Type `@` in notes to mention project members
- **Dark mode** — Theme toggle in the top bar (persisted locally)
- **Email notifications** — Via Supabase Edge Function + Resend API
- **Real-time notifications** — Live bell icon with unread count via Supabase Realtime
- **Admin panel** — Manage users, roles, and projects
- **Charts** — 14-day task activity bar chart (Recharts)
- **Responsive** — Mobile-friendly with collapsible sidebar
- **Chrome extension** — Add tasks (with screenshots of the current tab) from any page — see [`chrome-extension/SETUP.md`](chrome-extension/SETUP.md)

---

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | Next.js 15 (App Router, JS)         |
| Database   | Supabase (PostgreSQL + RLS)         |
| Auth       | Supabase Auth (email/password)      |
| Editor     | TipTap                              |
| Styling    | Tailwind CSS                        |
| Components | Radix UI primitives (shadcn-style)  |
| Data fetch | React Query (@tanstack/react-query) |
| Charts     | Recharts                            |
| Email      | Resend (via Supabase Edge Function) |
| Dates      | date-fns                            |
| Icons      | lucide-react                        |

---

## Setup

### 1. Clone & install

```bash
git clone <your-repo-url>
cd donee
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.dev.local
```

Edit `.env.dev.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
EMAIL_FROM=noreply@donee.app
RESEND_API_KEY=re_your_key   # optional — emails log to console if not set
```

Optional: create `.env.prod.local` if you want to run the local dev server against your production Supabase project.

### 3. Run the Supabase migration

In your Supabase dashboard → **SQL Editor**, paste and run the migrations in order from:

```
supabase/migrations/
```

This creates all tables, RLS policies, triggers, and functions.

### 4. Configure Supabase Auth

1. Supabase Dashboard → **Authentication → Providers → Email** — make sure it's enabled
   (turn "Confirm email" on or off as you prefer; the sign-up page handles both)
2. **Authentication → URL Configuration → Redirect URLs** — add:
   - `http://localhost:3000/auth/callback**`
   - `https://your-production-url.com/auth/callback**`

   These are needed for email confirmation and password-reset links.

### 5. Deploy the Edge Function (optional — for email notifications)

Install the Supabase CLI, then:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy send-notification-email
```

Set the Edge Function secrets:

```bash
supabase secrets set RESEND_API_KEY=re_your_key
supabase secrets set EMAIL_FROM=noreply@donee.app
supabase secrets set NEXT_PUBLIC_APP_URL=https://your-production-url.com
```

Then in Supabase Dashboard → **Database → Webhooks**, create a webhook:

- **Table**: `notifications`
- **Events**: `INSERT`
- **URL**: `https://<project-ref>.supabase.co/functions/v1/send-notification-email`
- **HTTP Method**: `POST`

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

To run locally against production Supabase data:

```bash
npm run dev:prod
```

---

## Project Structure

```
donee/
├── app/
│   ├── page.js                        # Login / sign up page
│   ├── auth/callback/route.js         # Email link (confirm / recovery) code exchange
│   ├── forgot-password/page.js        # Request password reset email
│   ├── reset-password/page.js         # Set a new password
│   ├── dashboard/
│   │   ├── layout.js                  # Dashboard shell (sidebar + topbar)
│   │   ├── page.js                    # Main dashboard (stats + chart + project grid)
│   │   ├── tasks/
│   │   │   ├── page.js                # All tasks (server)
│   │   │   └── TasksPageClient.js     # All tasks (client, filters + table)
│   │   └── project/[id]/
│   │       ├── page.js                # Project view (server)
│   │       └── ProjectPageClient.js   # Project view (client)
│   └── admin/
│       ├── layout.js                  # Admin route guard (super_admin only)
│       ├── page.js                    # Admin page (server)
│       └── AdminClient.js             # Admin tabs (client)
├── components/
│   ├── layout/
│   │   ├── Sidebar.js                 # Collapsible sidebar
│   │   └── Topbar.js                  # Breadcrumb + notifications + user menu
│   ├── tasks/
│   │   ├── TaskTable.js               # Sortable, filterable task table
│   │   ├── TaskDrawer.js              # Slide-in task detail drawer with notes
│   │   ├── AddTaskModal.js            # Multi-step task creation modal
│   │   ├── ScreenshotPicker.js        # Multi-screenshot picker for new tasks
│   │   └── TaskFilters.js             # Multi-select filter bar
│   ├── dashboard/
│   │   ├── StatCards.js               # KPI stat cards
│   │   ├── TaskChart.js               # 14-day bar chart
│   │   └── ProjectGrid.js             # Project card grid
│   ├── admin/
│   │   ├── UsersTab.js                # User table with inline role editing
│   │   └── ProjectsTab.js             # Project list with create/edit/archive
│   ├── auth/
│   │   └── AuthLayout.js              # Shared layout for auth pages
│   ├── ui/
│   │   ├── Avatar.js                  # User avatar with initials fallback
│   │   ├── RichTextEditor.js          # TipTap editor (descriptions + notes)
│   │   ├── Badge.js                   # Project color badge
│   │   ├── PriorityTag.jsx            # Priority pill
│   │   ├── StatusTag.jsx              # Status pill
│   │   ├── SkeletonLoader.js          # Loading skeletons
│   │   └── NotificationDropdown.js    # Real-time notification bell
│   └── providers/
│       └── QueryProvider.js           # React Query client provider
├── lib/
│   ├── supabase.js                    # Supabase client + server factories
│   ├── permissions.js                 # Role-check helpers
│   ├── notifications.js               # Notification helpers (fetch, subscribe)
│   ├── screenshots.js                 # Screenshot validation + upload as task note
│   └── utils.js                       # cn(), getInitials(), truncate()
├── chrome-extension/                  # Donee Chrome extension (see SETUP.md inside)
├── supabase/
│   ├── migrations/001_init.sql        # Full DB schema + RLS + triggers
│   └── functions/
│       └── send-notification-email/
│           └── index.ts               # Deno edge function for email delivery
├── middleware.js                      # Auth route protection
└── .env.local.example                 # Environment variable template
```

---

## Permissions Matrix

| Action                 | super_admin | pm (own project) |  developer  |
| ---------------------- | :---------: | :--------------: | :---------: |
| View all projects      |      ✓      |   member only    | member only |
| Create project         |      ✓      |        ✓         |      ✗      |
| Edit/archive project   |      ✓      |     ✓ (own)      |      ✗      |
| Add task               |      ✓      |        ✓         | ✓ (member)  |
| Edit any task          |      ✓      | ✓ (own project)  |      ✗      |
| Edit own assigned task |      ✓      |        ✓         |      ✓      |
| Delete task            |      ✓      |        ✓         |   ✓ (own)   |
| Assign tasks           |      ✓      |        ✓         |      ✗      |
| Manage users/roles     |      ✓      |        ✗         |      ✗      |
| Access /admin          |      ✓      |        ✗         |      ✗      |

---

## Making a User Super Admin

After you sign up, run this in the Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'your@email.com';
```

---

## Production Deployment

This app deploys to Vercel with zero config:

```bash
npm run build
vercel deploy
```

Set all `.env.local` variables as Vercel Environment Variables, and update `NEXT_PUBLIC_APP_URL` to your production URL.

Branch flow: push to `dev` (Vercel preview) → open a PR to `main` → merge to deploy production.
