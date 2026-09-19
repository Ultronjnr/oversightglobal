import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Public endpoint (verify_jwt = false): validates an unsubscribe token (GET)
// and records the opt-out (POST). Tokens live in email_unsubscribe_tokens.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server not configured' }, 500)
  const supabase = createClient(supabaseUrl, serviceKey)

  let token = ''
  if (req.method === 'GET') {
    token = new URL(req.url).searchParams.get('token') ?? ''
  } else if (req.method === 'POST') {
    try {
      const body = await req.json()
      token = String(body?.token ?? '')
    } catch {
      return json({ valid: false, reason: 'invalid_token' }, 400)
    }
  } else {
    return json({ error: 'Method not allowed' }, 405)
  }

  token = token.trim().slice(0, 200)
  if (!token) return json({ valid: false, reason: 'invalid_token' }, 400)

  const { data: row, error } = await supabase
    .from('email_unsubscribe_tokens')
    .select('id, email, used_at')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('unsubscribe lookup failed', error.message)
    return json({ valid: false, reason: 'error' }, 500)
  }
  if (!row) return json({ valid: false, reason: 'invalid_token' }, 404)
  if (row.used_at) return json({ valid: false, reason: 'already_unsubscribed' })

  if (req.method === 'GET') return json({ valid: true, email: row.email })

  const email = String(row.email ?? '').toLowerCase()

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason: 'unsubscribe', metadata: null }, { onConflict: 'email' })
  if (suppressError) {
    console.error('suppression upsert failed', suppressError.message)
    return json({ success: false, reason: 'error' }, 500)
  }

  const { error: stampError } = await supabase
    .from('email_unsubscribe_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('used_at', null)
  if (stampError) console.error('token stamp failed', stampError.message)

  await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: 'unsubscribed',
    error_message: 'Recipient unsubscribed via unsubscribe link',
    metadata: null,
  })

  return json({ success: true })
})
