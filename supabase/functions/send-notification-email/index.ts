// Supabase Edge Function — send-notification-email
// Triggered by Postgres Webhook on INSERT to public.notifications
// Deploy: supabase functions deploy send-notification-email
// Secrets (set via Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY      — from resend.com dashboard
//   EMAIL_FROM          — verified sender, e.g. "Donee <notifications@yourdomain.com>"
//                         On free Resend plan without verified domain: "onboarding@resend.dev"
//   NEXT_PUBLIC_APP_URL — e.g. https://yourapp.vercel.app

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRecord {
  id: string
  user_id: string
  actor_id?: string | null
  type: 'task_assigned' | 'note_mention' | 'task_created'
  task_id: string
  message: string
  is_read: boolean
  created_at: string
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: NotificationRecord
  schema: string
}

// Strip HTML tags for plain-text email fallback
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
}

function isEnvTruthy(name: string) {
  const raw = (Deno.env.get(name) ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function runtimeMeta() {
  return {
    deploymentId: Deno.env.get('DENO_DEPLOYMENT_ID') ?? null,
    executionId: Deno.env.get('SB_EXECUTION_ID') ?? null,
    region: Deno.env.get('SB_REGION') ?? null,
  }
}

async function sendWithResend(params: {
  apiKey: string
  from: string
  to: string | string[]
  subject: string
  html: string
  text: string
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  })

  const raw = await res.text()

  if (!res.ok) {
    throw new Error(`Resend API error: ${raw}`)
  }

  try {
    return JSON.parse(raw)
  } catch {
    return { id: undefined }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    const rawDisabled = Deno.env.get('EMAIL_NOTIFICATIONS_DISABLED') ?? null
    return jsonResponse({
      ok: true,
      emailNotificationsDisabled: isEnvTruthy('EMAIL_NOTIFICATIONS_DISABLED'),
      emailNotificationsDisabledRaw: rawDisabled,
      hasResendApiKey: !!Deno.env.get('RESEND_API_KEY'),
      emailFrom: Deno.env.get('EMAIL_FROM') ?? null,
      appUrl: Deno.env.get('NEXT_PUBLIC_APP_URL') ?? null,
      ...runtimeMeta(),
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: `Method not allowed: ${req.method}`, allowed: ['GET', 'POST', 'OPTIONS'], ...runtimeMeta() },
      { status: 405 },
    )
  }

  const rawDisabled = Deno.env.get('EMAIL_NOTIFICATIONS_DISABLED') ?? null
  if (isEnvTruthy('EMAIL_NOTIFICATIONS_DISABLED')) {
    return jsonResponse({
      skipped: 'email_notifications_disabled',
      emailNotificationsDisabled: true,
      emailNotificationsDisabledRaw: rawDisabled,
      ...runtimeMeta(),
    })
  }

  try {
    const rawBody = await req.text()
    if (!rawBody.trim()) {
      return jsonResponse({ error: 'Empty request body', ...runtimeMeta() }, { status: 400 })
    }

    const payload: WebhookPayload = JSON.parse(rawBody)

    if (payload.type !== 'INSERT') {
      return jsonResponse({ skipped: 'not INSERT' })
    }

    const notification = payload.record
    const knownTypes = ['task_assigned', 'note_mention', 'task_created', 'workspace_invite'] as const
    if (!knownTypes.includes(notification.type)) {
      return jsonResponse({ skipped: `unknown type: ${notification.type}` })
    }

    // Use service role to bypass RLS
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL') ??
      Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') ??
      ''
    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(
        {
          error:
            'Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) in Edge Function secrets',
        },
        { status: 500 },
      )
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
    )

    const getAuthEmailForUserId = async (userId: string) => {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
      if (authError || !authUser?.user?.email) return null
      return authUser.user.email
    }

    // Fetch recipient profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', notification.user_id)
      .single()

    const actorId = notification.actor_id ?? null
    const { data: actorProfile } = actorId
      ? await supabase.from('profiles').select('full_name').eq('id', actorId).single()
      : { data: null }

    // Fetch task + project
    const { data: task } = await supabase
      .from('tasks')
      .select('title, project:projects(name, pm_id)')
      .eq('id', notification.task_id)
      .single()

    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000'
    const taskLink = `${appUrl}/dashboard/tasks?task=${notification.task_id}`
    // Default to Resend's shared domain (works on free plan, sends to any address)
    const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev'
    const recipientName = profile?.full_name ?? 'there'
    const taskTitle = task?.title ?? 'a task'
    // @ts-ignore
    const projectName = task?.project?.name ?? ''
    // @ts-ignore
    const projectPmId = task?.project?.pm_id ?? null
    const actorName = actorProfile?.full_name ?? 'Someone'

    let subject = ''
    let htmlBody = ''

    // ── Email templates ──────────────────────────────────────────────────────
    const emailHeader = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#f8fafc;padding:40px 0;margin:0;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
  <div style="background:#4f46e5;padding:24px 32px;">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Donee</h1>
  </div>
  <div style="padding:32px;">`

    const emailFooter = (footerText: string) => `
  </div>
  <div style="padding:16px 32px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">${footerText}</p>
  </div>
</div></body></html>`

    const taskCard = (label: string) => `
<div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin:16px 0 24px;">
  <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">${label}</p>
  <p style="margin:6px 0 0;font-size:16px;color:#1e293b;font-weight:600;">${taskTitle}</p>
  ${projectName ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b;">in ${projectName}</p>` : ''}
</div>`

    const ctaButton = (text: string, href: string) =>
      `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${text}</a>`

    if (notification.type === 'task_assigned') {
      subject = `[Donee] Assigned to you: ${taskTitle}`
      htmlBody = emailHeader +
        `<p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${recipientName},</p>
         <p style="color:#475569;font-size:15px;margin:0 0 4px;">You've been assigned a new task.</p>` +
        taskCard('Task') +
        ctaButton('View Task', taskLink) +
        emailFooter('You received this because you were assigned a task on Donee.')
    }

    else if (notification.type === 'note_mention') {
      subject = `[Donee] You were mentioned: ${taskTitle}`
      htmlBody = emailHeader +
        `<p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${recipientName},</p>
         <p style="color:#475569;font-size:15px;margin:0 0 4px;">${stripHtml(notification.message ?? '')}</p>` +
        taskCard('Task') +
        ctaButton('View Note', taskLink) +
        emailFooter('You received this because someone mentioned you in a note on Donee.')
    }

    else if (notification.type === 'task_created') {
      subject = `[Donee] New task created: ${taskTitle}`
      htmlBody = emailHeader +
        `<p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${recipientName},</p>
         <p style="color:#475569;font-size:15px;margin:0 0 4px;">${stripHtml(notification.message ?? '')}</p>` +
        taskCard('New Task') +
        ctaButton('Review Task', taskLink) +
        emailFooter('You received this because you manage this project on Donee.')
    }

    else if (notification.type === 'workspace_invite') {
      const workspaceLink = `${appUrl}/workspace`
      subject = `[Donee] You've been added to a workspace`
      htmlBody = emailHeader +
        `<p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${recipientName},</p>
         <p style="color:#475569;font-size:15px;margin:0 0 4px;">${stripHtml(notification.message ?? 'You have been added to a workspace on Donee.')}</p>` +
        `<div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin:16px 0 24px;">
           <p style="margin:0;font-size:14px;color:#1e293b;">Sign in to Donee to access your new workspace.</p>
         </div>` +
        ctaButton('Open Donee', workspaceLink) +
        emailFooter('You received this because you were added to a workspace on Donee.')
    }

    // ── Send via Resend ──────────────────────────────────────────────────────
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      return jsonResponse({ error: 'Missing RESEND_API_KEY in Edge Function secrets' }, { status: 500 })
    }

    const recipientEmail = await getAuthEmailForUserId(notification.user_id)
    if (!recipientEmail) {
      return jsonResponse({ error: 'Recipient email not found' }, { status: 400 })
    }

    const resendData = await sendWithResend({
      apiKey: resendApiKey,
      from: emailFrom,
      to: recipientEmail,
      subject,
      html: htmlBody,
      text: stripHtml(htmlBody),
    })

    const extra: Record<string, unknown> = {}

    const isSelfAssigned =
      notification.type === 'task_assigned' && !!actorId && actorId === notification.user_id

    if (isSelfAssigned && projectPmId && projectPmId !== notification.user_id) {
      const pmEmail = await getAuthEmailForUserId(projectPmId)
      if (pmEmail) {
        const pmSubject = `[Donee] ${actorName} self-assigned: ${taskTitle}`
        const pmHtml =
          emailHeader +
          `<p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi,</p>
           <p style="color:#475569;font-size:15px;margin:0 0 4px;">${actorName} assigned a task to themselves.</p>` +
          taskCard('Task') +
          ctaButton('View Task', taskLink) +
          emailFooter('You received this because you are the PM of this project on Donee.')

        const pmResendData = await sendWithResend({
          apiKey: resendApiKey,
          from: emailFrom,
          to: pmEmail,
          subject: pmSubject,
          html: pmHtml,
          text: stripHtml(pmHtml),
        })

        extra.pmResendId = pmResendData?.id
      }
    }

    return jsonResponse({ success: true, resendId: resendData?.id, ...extra })
  } catch (err) {
    console.error('Edge function error:', err)
    return jsonResponse({ error: String(err) }, { status: 500 })
  }
})
