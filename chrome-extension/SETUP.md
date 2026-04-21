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
```

## 3. Find your extension ID (for OAuth redirect)

You need the extension ID **before** loading it in Chrome, because it is derived from the extension's key. For development:

1. Build the extension first: `npm run build`
2. Open Chrome → `chrome://extensions` → Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder
4. Note the extension ID shown (e.g. `abcdefghijklmnopqrstuvwxyz123456`)

The redirect URL will be: `https://<extension-id>.chromiumapp.org/`

## 4. Add redirect URL to Supabase

In Supabase Dashboard → Authentication → URL Configuration → **Redirect URLs**, add:

```
https://<your-extension-id>.chromiumapp.org/
```

## 5. Generate icons

```bash
npm run generate-icons
```

This creates `public/icons/icon16.png`, `icon48.png`, `icon128.png` (indigo squares).

## 6. Build

```bash
npm run build
```

Output is in `dist/`.

## 7. Load in Chrome

1. `chrome://extensions` → Developer mode ON
2. **Load unpacked** → select `dist/`
3. Click the Donee icon in the toolbar

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
- OAuth uses PKCE flow (no implicit tokens)
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
