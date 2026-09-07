import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { decodeJwtRole, logEmailSend } from '../_shared/email-send-log.ts'

// Sends the supplier invitation (and its reminders) for exactly one recipient.
// Authorization mirrors the previous pipeline: an internal service-role caller
// (the reminder job) or a signed-in ADMIN of the organization that owns a
// pending supplier invitation for that recipient.

const TEMPLATE = 'supplier-invitation'

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('send-supplier-invitation-email: missing env')
    return json({ error: 'Server configuration error' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }

  const recipientEmail = String(body.recipientEmail ?? body.email ?? '').trim().toLowerCase()
  const registrationUrl = String(body.registrationUrl ?? '')
  const contactPerson = body.contactPerson ? String(body.contactPerson) : undefined
  const companyName = body.companyName ? String(body.companyName) : undefined
  const reminder = body.reminder ? String(body.reminder) : undefined
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined

  if (!recipientEmail) return json({ error: 'recipientEmail is required' }, 400)
  if (!registrationUrl) return json({ error: 'registrationUrl is required' }, 400)

  const supabase = createClient(supabaseUrl, serviceKey)

  const callerToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (decodeJwtRole(callerToken) !== 'service_role') {
    const { data: userData, error: userErr } = await supabase.auth.getUser(callerToken)
    const caller = userData?.user
    if (userErr || !caller) return json({ error: 'Authentication required' }, 401)

    const { data: invitation } = await supabase
      .from('supplier_invitations')
      .select('organization_id')
      .ilike('email', recipientEmail)
      .in('status', ['PENDING', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const orgId = invitation?.organization_id ?? null
    if (!orgId) return json({ error: 'No matching pending invitation for this recipient' }, 403)

    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('organization_id').eq('id', caller.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', caller.id).in('role', ['ADMIN']),
    ])

    if (!Array.isArray(roleRows) || roleRows.length === 0 || !prof || prof.organization_id !== orgId) {
      return json({ error: 'Not authorized to send this email' }, 403)
    }
  }

  try {
    const result = await sendTemplateEmail(TEMPLATE, recipientEmail, {
      idempotencyKey,
      templateData: { contactPerson, companyName, registrationUrl, reminder },
    })

    if (!result.sent) {
      await logEmailSend(supabase, {
        template_name: TEMPLATE,
        recipient_email: recipientEmail,
        status: 'suppressed',
      })
      return json({ success: false, reason: 'email_suppressed' })
    }

    await logEmailSend(supabase, {
      template_name: TEMPLATE,
      recipient_email: recipientEmail,
      status: 'sent',
    })
    return json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('send-supplier-invitation-email: send failed', { message })
    await logEmailSend(supabase, {
      template_name: TEMPLATE,
      recipient_email: recipientEmail,
      status: 'failed',
      error_message: message.slice(0, 1000),
    })
    return json({ error: 'Failed to send supplier invitation email' }, 500)
  }
})
