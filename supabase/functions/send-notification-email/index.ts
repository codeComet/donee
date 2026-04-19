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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: WebhookPayload = await req.json()

    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ skipped: 'not INSERT' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const notification = payload.record
    const knownTypes = ['task_assigned', 'note_mention', 'task_created']
    if (!knownTypes.includes(notification.type)) {
      return new Response(JSON.stringify({ skipped: `unknown type: ${notification.type}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Fetch recipient's auth email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
      notification.user_id,
    )
    if (authError || !authUser?.user?.email) {
      console.error('Failed to fetch user email:', authError)
      return new Response(JSON.stringify({ error: 'User email not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const recipientEmail = authUser.user.email

    // Fetch recipient profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', notification.user_id)
      .single()

    // Fetch task + project
    const { data: task } = await supabase
      .from('tasks')
      .select('title, project:projects(name)')
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

    // ── Send via Resend ──────────────────────────────────────────────────────
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not set — would have sent:', { to: recipientEmail, subject })
      return new Response(JSON.stringify({ skipped: 'no RESEND_API_KEY' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: recipientEmail,
        subject,
        html: htmlBody,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Resend error:', errText)
      throw new Error(`Resend API error: ${errText}`)
    }

    const resendData = await res.json()
    console.log(`Email sent — type: ${notification.type}, to: ${recipientEmail}, id: ${resendData.id}`)

    return new Response(
      JSON.stringify({ success: true, recipient: recipientEmail, resendId: resendData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
