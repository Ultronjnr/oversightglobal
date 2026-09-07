import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { decodeJwtRole, logEmailSend } from '../_shared/email-send-log.ts'

// Emails a single Section 18A donation receipt to the donor on file.
// All email content is re-derived from the database so a caller cannot inject
// phishing links or names.

const TEMPLATE = 'donation-receipt'
const APP_BASE_URL = 'https://ovasyt.tech'

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
    console.error('send-donation-receipt-email: missing env')
    return json({ error: 'Server configuration error' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }

  const receiptId = String(body.receiptId ?? body.receipt_id ?? '')
  const recipientEmail = String(body.recipientEmail ?? body.email ?? '').trim().toLowerCase()
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : `donation-receipt-${receiptId}`

  if (!receiptId) return json({ error: 'receiptId is required' }, 400)
  if (!recipientEmail) return json({ error: 'recipientEmail is required' }, 400)

  const supabase = createClient(supabaseUrl, serviceKey)

  const callerToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const isServiceRole = decodeJwtRole(callerToken) === 'service_role'

  const { data: receipt } = await supabase
    .from('donation_receipts')
    .select('id, organization_id, donor_id, receipt_number, verification_hash, pdf_path, status')
    .eq('id', receiptId)
    .maybeSingle()

  if (!receipt) return json({ error: 'Receipt not found' }, 404)
  // deno-lint-ignore no-explicit-any
  if ((receipt as any).status === 'CANCELLED') return json({ error: 'Receipt is cancelled' }, 400)

  if (!isServiceRole) {
    const { data: userData, error: userErr } = await supabase.auth.getUser(callerToken)
    const caller = userData?.user
    if (userErr || !caller) return json({ error: 'Authentication required' }, 401)

    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('organization_id').eq('id', caller.id).maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', caller.id)
        .in('role', ['ADMIN', 'FINANCE']),
    ])

    if (
      !Array.isArray(roleRows) ||
      roleRows.length === 0 ||
      !prof ||
      // deno-lint-ignore no-explicit-any
      prof.organization_id !== (receipt as any).organization_id
    ) {
      return json({ error: 'Not authorized to send this email' }, 403)
    }
  }

  const { data: donor } = await supabase
    .from('organization_donors')
    .select('id, name, email')
    // deno-lint-ignore no-explicit-any
    .eq('id', (receipt as any).donor_id)
    .maybeSingle()

  // deno-lint-ignore no-explicit-any
  const donorEmail = String((donor as any)?.email ?? '').toLowerCase()
  if (!donor || !donorEmail || donorEmail !== recipientEmail) {
    return json({ error: 'Recipient does not match donor on receipt' }, 403)
  }

  let signedDownloadUrl: string | null = null
  // deno-lint-ignore no-explicit-any
  const pdfPath = (receipt as any).pdf_path
  if (pdfPath) {
    const { data: signed } = await supabase.storage
      .from('donation-receipts')
      .createSignedUrl(pdfPath, 60 * 60 * 24 * 7)
    signedDownloadUrl = signed?.signedUrl ?? null
  }

  const templateData = {
    // deno-lint-ignore no-explicit-any
    donorName: (donor as any).name,
    // deno-lint-ignore no-explicit-any
    receiptNumber: (receipt as any).receipt_number,
    downloadUrl: signedDownloadUrl ?? '',
    // deno-lint-ignore no-explicit-any
    verifyUrl: `${APP_BASE_URL}/verify/receipt/${(receipt as any).id}?h=${(receipt as any).verification_hash ?? ''}`,
  }

  try {
    const result = await sendTemplateEmail(TEMPLATE, donorEmail, {
      idempotencyKey,
      templateData,
    })

    if (!result.sent) {
      await logEmailSend(supabase, {
        template_name: TEMPLATE,
        recipient_email: donorEmail,
        status: 'suppressed',
      })
      return json({ success: false, reason: 'email_suppressed' })
    }

    await logEmailSend(supabase, {
      template_name: TEMPLATE,
      recipient_email: donorEmail,
      status: 'sent',
    })
    return json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('send-donation-receipt-email: send failed', { message })
    await logEmailSend(supabase, {
      template_name: TEMPLATE,
      recipient_email: donorEmail,
      status: 'failed',
      error_message: message.slice(0, 1000),
    })
    return json({ error: 'Failed to send donation receipt email' }, 500)
  }
})
