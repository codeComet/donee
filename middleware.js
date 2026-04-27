import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { WORKSPACE_COOKIE } from '@/lib/workspace'

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users to login
  if ((pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) && !user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Redirect authenticated users away from login
  if (pathname === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Workspace check: authenticated users on /dashboard or /admin need a workspace cookie
  if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
    const workspaceId = request.cookies.get(WORKSPACE_COOKIE)?.value
    if (!workspaceId) {
      return NextResponse.redirect(new URL('/workspace', request.url))
    }
  }

  // Redirect authenticated users away from /workspace if they already have a workspace selected
  // (let the workspace page handle this logic instead — don't redirect from middleware)

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
