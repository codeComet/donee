import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { WORKSPACE_COOKIE } from '@/lib/workspace'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Check if user has a workspace already selected
      const hasWorkspaceCookie = !!cookieStore.get(WORKSPACE_COOKIE)?.value

      if (!hasWorkspaceCookie && user) {
        // Check if user belongs to any workspace
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)

        if (!memberships || memberships.length === 0) {
          // New user with no workspace — redirect to onboarding
          return NextResponse.redirect(`${origin}/workspace`)
        }

        // Has workspace memberships but no cookie — let middleware handle redirect
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Auth callback error:', error.message)
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}
