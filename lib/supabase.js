import { createBrowserClient, createServerClient } from '@supabase/ssr'

// ── Browser client (Client Components) ─────────────────────────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// ── Server client (Server Components / Route Handlers) ──────────────────────
// Pass in the cookieStore obtained from `cookies()` (next/headers).
// Do NOT call cookies() here — that would break client imports.
export function createServerSideClient(cookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot set cookies; handled by middleware
          }
        },
      },
    }
  )
}
