import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Receives terminal delivery outcomes (bounce, complaint, unsubscribe) from
// Lovable's managed email delivery and mirrors them into the app's own
// records, exactly as the previous webhook handlers did. These rows are
// notification/reporting only — Lovable enforces suppression at send time.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'

const LOG_STATUS: Record<SuppressionReason, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const LOG_MESSAGE: Record<SuppressionReason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function record(
  reason: SuppressionReason,
  recipient: string,
  eventId: string,
): Promise<void> {
  const email = String(recipient ?? '').toLowerCase()
  if (!email) return

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      code: suppressError.code,
      message: suppressError.message,
      event_id: eventId,
    })
    throw new Error('Failed to write suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: LOG_STATUS[reason],
    error_message: LOG_MESSAGE[reason],
    metadata: null,
  })

  if (logError) {
    console.error('Failed to insert email_send_log row', {
      code: logError.code,
      message: logError.message,
      event_id: eventId,
    })
    throw new Error('Failed to write email send log')
  }

  if (reason === 'unsubscribe') {
    // Keep legacy unsubscribe tokens consistent with the recipient's state.
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('email', email)
      .is('used_at', null)

    if (tokenError) {
      console.error('Failed to stamp unsubscribe token', {
        code: tokenError.code,
        message: tokenError.message,
        event_id: eventId,
      })
    }
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record('bounce', event.data.recipient, event.event_id)
    },
    'email.complaint': async (event) => {
      await record('complaint', event.data.recipient, event.event_id)
    },
    'email.unsubscribed': async (event) => {
      await record('unsubscribe', event.data.recipient, event.event_id)
    },
  },
})

Deno.serve((req) => handler(req))
