# Donee Chrome Extension — Setup Guide

## Prerequisites

- Node.js 18+
- The Donee web app Supabase project

---

## 1. Install dependencies

```bash
cd chrome-extension
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://your-web-app-domain   # used for "Forgot password?" and "Sign up" links
```

Sign in uses **email + password** (same accounts as the web app). No OAuth redirect URL is needed for the extension.
Password reset and sign up happen in the web app, so make sure the web app's `/auth/callback**` is in
Supabase → Authentication → URL Configuration → Redirect URLs.

## 3. Generate icons

```bash
npm run generate-icons
```

This creates `public/icons/icon16.png`, `icon48.png`, `icon128.png` (indigo squares).

## 4. Build

```bash
npm run build
```

Output is in `dist/`.

If the build fails with `Cannot find module @rollup/rollup-darwin-arm64` (or another platform), reinstall:
`rm -rf node_modules && npm install`.

## 5. Load in Chrome

1. `chrome://extensions` → Developer mode ON
2. **Load unpacked** → select `dist/`
3. Click the puzzle icon in the toolbar → pin **Donee**

After a rebuild, click the reload ↻ icon on the Donee card. If the manifest's permissions changed, Chrome asks you to approve them.

---

## Adding tasks

The **Add Task** tab supports:

- **Rich-text description** (TipTap: bold, italic, bullet/numbered lists)
- **Screenshots** — any number, via:
  - **Capture this tab** (`chrome.tabs.captureVisibleTab`; not available on `chrome://` or Web Store pages)
  - **Upload images** (multi-select)
  - **Paste** (Ctrl/⌘+V anywhere in the form)

  PNG/JPEG/GIF/WebP, max 5 MB each. On create, they're uploaded to the `task-images` bucket and added to the
  task as a single note (visible under Notes in the task drawer).

---

## Development

```bash
npm run dev   # watch mode — auto-rebuilds on file changes
```

Reload the extension in `chrome://extensions` after each rebuild.

---

## Security notes

- The Supabase anon key is safe to embed (it's already public in the web app)
- All data security is enforced via Supabase RLS policies
- Session tokens are stored in `chrome.storage.local` (isolated per extension, not accessible by web pages)
- Sign in exchanges email + password for a session via Supabase Auth (`grant_type=password`) in the background worker
- Permissions: `storage` (session), `activeTab` (capture the current tab only when the popup is opened on it)
- Sign out revokes the session server-side

---

## Role capabilities

| Feature | Developer | PM | Super Admin |
|---------|:---------:|:--:|:-----------:|
| View assigned tasks | ✓ | ✓ (all) | ✓ (all) |
| Create task | ✓ (self-assign) | ✓ | ✓ |
| Assign task | ✗ | ✓ | ✓ |
| Change task status | ✓ (own) | ✓ | ✓ |
| View projects | ✗ | ✓ (own) | ✓ |
| Create project | ✗ | ✓ | ✓ |
| Manage users | ✗ | ✗ | ✓ |
