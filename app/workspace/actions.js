'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'
import { WORKSPACE_COOKIE } from '@/lib/workspace'

function cookieOpts() {
  return { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 }
}

export async function createWorkspace(formData) {
  const name = formData.get('name')?.toString().trim()
  if (!name) return { error: 'Workspace name is required' }

  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, created_by: user.id })
    .select('id')
    .single()

  if (wsError) return { error: wsError.message }

  // Add creator as super_admin member
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'super_admin' })

  if (memberError) return { error: memberError.message }

  cookieStore.set(WORKSPACE_COOKIE, workspace.id, cookieOpts())
  redirect('/dashboard')
}

export async function joinWorkspace(formData) {
  const code = formData.get('code')?.toString().trim()
  if (!code) return { error: 'Invite code is required' }

  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const { data, error } = await supabase.rpc('join_workspace_by_code', { p_invite_code: code })

  if (error) return { error: error.message }
  if (data?.error) return { error: data.error }

  const workspaceId = data?.workspace_id
  if (!workspaceId) return { error: 'Failed to join workspace' }

  cookieStore.set(WORKSPACE_COOKIE, workspaceId, cookieOpts())
  redirect('/dashboard')
}

export async function switchWorkspace(workspaceId) {
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify user is a member
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!member && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: adminMember, error: adminMemberError } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminMember) {
      cookieStore.set(WORKSPACE_COOKIE, workspaceId, cookieOpts())
      redirect('/dashboard')
    }

    if (adminMemberError) return { error: adminMemberError.message }
  }

  if (memberError) return { error: memberError.message }
  if (!member) return { error: 'Not a member of this workspace' }

  cookieStore.set(WORKSPACE_COOKIE, workspaceId, cookieOpts())
  redirect('/dashboard')
}
