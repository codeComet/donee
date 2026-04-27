import { cookies } from 'next/headers'
import { createServerSideClient } from '@/lib/supabase'

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { invitationId, workspaceId } = await request.json()
  if (!invitationId || !workspaceId) {
    return Response.json({ error: 'Missing invitationId or workspaceId' }, { status: 400 })
  }

  // Verify caller is a super_admin in this workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (member?.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch invitation + workspace name
  const { data: invitation, error: invErr } = await supabase
    .from('workspace_invitations')
    .select('invite_code, email, workspace:workspaces(name)')
    .eq('id', invitationId)
    .eq('workspace_id', workspaceId)
    .single()

  if (invErr || !invitation) {
    return Response.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (!invitation.email) {
    return Response.json({ error: 'Invitation has no email address' }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return Response.json({ error: 'Email service not configured (missing RESEND_API_KEY)' }, { status: 500 })
  }

  const emailFrom = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const workspaceName = invitation.workspace?.name ?? 'a workspace'
  const joinUrl = `${appUrl}/workspace`

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 0;margin:0;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
  <div style="background:#4f46e5;padding:24px 32px;">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Donee</h1>
  </div>
  <div style="padding:32px;">
    <p style="color:#1e293b;font-size:16px;margin:0 0 16px;">You've been invited to join <strong>${workspaceName}</strong> on Donee.</p>
    <p style="color:#475569;font-size:15px;margin:0 0 16px;">Use the invite code below to join:</p>
    <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:16px 0 24px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Invite Code</p>
      <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#4f46e5;letter-spacing:.1em;font-family:monospace;">${invitation.invite_code}</p>
    </div>
    <a href="${joinUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Join Workspace</a>
    <p style="color:#94a3b8;font-size:13px;margin:20px 0 0;">This invite expires in 7 days. Go to Donee → Join Workspace and enter the code above.</p>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">You received this because someone invited you to ${workspaceName} on Donee.</p>
  </div>
</div>
</body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: invitation.email,
      subject: `[Donee] You're invited to join ${workspaceName}`,
      html,
      text: stripHtml(html),
    }),
  })

  if (!res.ok) {
    const raw = await res.text()
    return Response.json({ error: `Email send failed: ${raw}` }, { status: 500 })
  }

  const result = await res.json()
  return Response.json({ success: true, resendId: result?.id })
}
