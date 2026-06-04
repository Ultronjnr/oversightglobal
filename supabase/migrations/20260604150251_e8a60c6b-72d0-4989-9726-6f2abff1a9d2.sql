ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'quote_request_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'quote_accepted';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'invoice_rejected';