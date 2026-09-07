// Shared helpers for the app's own email bookkeeping.
//
// Delivery itself (retries, suppression, rate limits, unsubscribe) is handled
// by Lovable's managed email API. These helpers only append rows to the app's
// email_send_log table so existing reporting keeps working.

// deno-lint-ignore no-explicit-any
type SupabaseLike = any

export type EmailLogStatus =
  | 'sent'
  | 'suppressed'
  | 'failed'
  | 'bounced'
  | 'complained'
  | 'pending'

export async function logEmailSend(
  supabase: SupabaseLike,
  entry: {
    message_id?: string | null
    template_name: string
    recipient_email: string
    status: EmailLogStatus
    error_message?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from('email_send_log').insert({
    message_id: entry.message_id ?? null,
    template_name: entry.template_name,
    recipient_email: entry.recipient_email,
    status: entry.status,
    error_message: entry.error_message ?? null,
  })
  if (error) {
    console.error('Failed to write email_send_log row', {
      code: error.code,
      message: error.message,
      status: entry.status,
    })
  }
}

/** Decode a JWT payload without verifying (the gateway verified the signature). */
export function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return (JSON.parse(json)?.role as string) ?? null
  } catch {
    return null
  }
}
