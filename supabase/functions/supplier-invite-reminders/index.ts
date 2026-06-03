import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Base URL the registration link points to.
const APP_URL = 'https://ovasyt.tech'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const now = new Date()

  const { data: invites, error } = await supabase
    .from('supplier_invitations')
    .select('id, email, company_name, contact_person, token, created_at, expires_at, reminder_sent_at, expiry_reminder_sent_at')
    .eq('status', 'PENDING')

  if (error) {
    console.error('Failed to load invitations', error)
    return new Response(JSON.stringify({ error: 'Failed to load invitations' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0

  for (const inv of invites ?? []) {
    const created = new Date(inv.created_at).getTime()
    const expires = new Date(inv.expires_at).getTime()
    if (expires < now.getTime()) continue // expired, skip

    const registrationUrl = `${APP_URL}/supplier/register?token=${inv.token}`
    const baseData = {
      contactPerson: inv.contact_person,
      companyName: inv.company_name,
      registrationUrl,
    }

    const hoursSinceCreated = (now.getTime() - created) / 3_600_000
    const hoursToExpiry = (expires - now.getTime()) / 3_600_000

    // Email 3: final reminder within 48h of expiry
    if (hoursToExpiry <= 48 && !inv.expiry_reminder_sent_at) {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'supplier-invitation',
          recipientEmail: inv.email,
          idempotencyKey: `supplier-expiry-${inv.token}`,
          templateData: { ...baseData, reminder: 'expiry' },
        },
      })
      await supabase
        .from('supplier_invitations')
        .update({ expiry_reminder_sent_at: now.toISOString() })
        .eq('id', inv.id)
      sent++
      continue
    }

    // Email 2: reminder ~24h after invite
    if (hoursSinceCreated >= 24 && hoursToExpiry > 48 && !inv.reminder_sent_at) {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'supplier-invitation',
          recipientEmail: inv.email,
          idempotencyKey: `supplier-reminder-${inv.token}`,
          templateData: { ...baseData, reminder: 'reminder' },
        },
      })
      await supabase
        .from('supplier_invitations')
        .update({ reminder_sent_at: now.toISOString() })
        .eq('id', inv.id)
      sent++
    }
  }

  return new Response(JSON.stringify({ success: true, sent }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})