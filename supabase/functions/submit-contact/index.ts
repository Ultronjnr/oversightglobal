import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Public endpoint (verify_jwt = false). Rate-limited implicitly by
// Supabase gateway; validates all inputs, persists submission, then invokes
// the internal send-transactional-email function with the service role.

const MAX = { name: 120, email: 255, phone: 40, org: 160, subject: 120, message: 4000 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('submit-contact: missing env')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const name = clean(payload.name, MAX.name)
  const email = clean(payload.email, MAX.email).toLowerCase()
  const phone = clean(payload.phone, MAX.phone)
  const organisation = clean(payload.organisation, MAX.org)
  const subject = clean(payload.subject, MAX.subject)
  const message = clean(payload.message, MAX.message)
  const source = clean(payload.source, 80) || 'contact-page'

  const errors: string[] = []
  if (!name) errors.push('name is required')
  if (!email || !EMAIL_RE.test(email)) errors.push('valid email is required')
  if (!phone) errors.push('phone is required')
  if (!subject) errors.push('subject is required')
  if (!message || message.length < 5) errors.push('message is required')
  if (errors.length) {
    return new Response(JSON.stringify({ error: errors.join(', ') }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null

  const { data: row, error: insertErr } = await supabase
    .from('contact_submissions')
    .insert({ name, email, phone, organisation, subject, message, source, user_agent: userAgent })
    .select('id, created_at')
    .single()

  if (insertErr || !row) {
    console.error('submit-contact: insert failed', insertErr)
    return new Response(
      JSON.stringify({ error: 'Could not save your message. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Send notification email to info@ovasyt.tech via the internal template pipeline.
  const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      templateName: 'contact-enquiry',
      idempotencyKey: `contact-${row.id}`,
      templateData: {
        name,
        email,
        phone,
        organisation,
        subject,
        message,
        submittedAt: new Date(row.created_at as string).toUTCString(),
      },
    }),
  })

  if (!emailRes.ok) {
    const errText = await emailRes.text().catch(() => '')
    console.error('submit-contact: email dispatch failed', emailRes.status, errText)
    await supabase
      .from('contact_submissions')
      .update({ email_status: 'failed', email_error: errText.slice(0, 500) })
      .eq('id', row.id)
    // We still return success — the submission is stored and staff can follow up.
    return new Response(
      JSON.stringify({ ok: true, id: row.id, emailQueued: false }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  await supabase
    .from('contact_submissions')
    .update({ email_status: 'queued' })
    .eq('id', row.id)

  return new Response(
    JSON.stringify({ ok: true, id: row.id, emailQueued: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})