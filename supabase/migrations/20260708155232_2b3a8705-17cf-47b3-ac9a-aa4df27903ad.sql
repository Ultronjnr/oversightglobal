
-- ========== ENUMS ==========
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('TRIALING','ACTIVE','PAST_DUE','CANCELLED','INCOMPLETE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('MONTHLY','ANNUAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('DRAFT','OPEN','PAID','FAILED','VOID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.netcash_status AS ENUM ('PENDING','SUBMITTED','PROCESSING','SETTLED','FAILED','RETRYING','CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ========== subscription_plans ==========
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_annual numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_limit integer,
  storage_gb integer,
  tier integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  is_custom boolean NOT NULL DEFAULT false,
  is_recommended boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are viewable by everyone" ON public.subscription_plans
  FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'ADMIN'::app_role))
  WITH CHECK (has_role(auth.uid(),'ADMIN'::app_role));

-- ========== organization_subscriptions ==========
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  status public.subscription_status NOT NULL DEFAULT 'INCOMPLETE',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'MONTHLY',
  current_period_start date,
  current_period_end date,
  next_billing_date date,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_subscriptions TO authenticated;
GRANT ALL ON public.organization_subscriptions TO service_role;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own org subscription" ON public.organization_subscriptions
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Admins manage own org subscription" ON public.organization_subscriptions
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(),'ADMIN'::app_role))
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(),'ADMIN'::app_role));

-- ========== payment_methods (card vault refs) ==========
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'YOCO',
  provider_token text NOT NULL,
  brand text,
  last4 text,
  expiry_month integer,
  expiry_year integer,
  is_default boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage org payment methods" ON public.payment_methods
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(),'ADMIN'::app_role))
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(),'ADMIN'::app_role));

-- ========== subscription_invoices ==========
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.subscription_plans(id),
  invoice_number text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status public.invoice_status NOT NULL DEFAULT 'DRAFT',
  period_start date,
  period_end date,
  due_date date,
  paid_at timestamptz,
  yoco_charge_id text,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view org invoices" ON public.subscription_invoices
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(),'ADMIN'::app_role));

-- ========== subscription_payment_attempts ==========
CREATE TABLE IF NOT EXISTS public.subscription_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  invoice_id uuid REFERENCES public.subscription_invoices(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'PENDING',
  error_message text,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payment_attempts TO authenticated;
GRANT ALL ON public.subscription_payment_attempts TO service_role;
ALTER TABLE public.subscription_payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view org payment attempts" ON public.subscription_payment_attempts
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization(auth.uid()) AND has_role(auth.uid(),'ADMIN'::app_role));

-- ========== netcash_payments ==========
CREATE TABLE IF NOT EXISTS public.netcash_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  batch_id uuid REFERENCES public.payment_batches(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES public.payment_allocations(id) ON DELETE SET NULL,
  netcash_reference text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status public.netcash_status NOT NULL DEFAULT 'PENDING',
  settled_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.netcash_payments TO authenticated;
GRANT ALL ON public.netcash_payments TO service_role;
ALTER TABLE public.netcash_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance/Admin manage org netcash payments" ON public.netcash_payments
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization(auth.uid()) AND (has_role(auth.uid(),'FINANCE'::app_role) OR has_role(auth.uid(),'ADMIN'::app_role)))
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND (has_role(auth.uid(),'FINANCE'::app_role) OR has_role(auth.uid(),'ADMIN'::app_role)));

-- ========== payment_provider_events (webhooks) ==========
CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text,
  external_id text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
GRANT ALL ON public.payment_provider_events TO service_role;
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;

-- ========== extend payment_batches ==========
ALTER TABLE public.payment_batches ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.payment_batches ADD COLUMN IF NOT EXISTS provider_status public.netcash_status;
ALTER TABLE public.payment_batches ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- ========== updated_at triggers ==========
CREATE TRIGGER trg_sub_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_subs_updated BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pay_methods_updated BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sub_inv_updated BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_netcash_pay_updated BEFORE UPDATE ON public.netcash_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== seed plans ==========
INSERT INTO public.subscription_plans (code,name,description,price_monthly,price_annual,features,user_limit,storage_gb,tier,is_public,is_custom,is_recommended)
VALUES
('STARTER','Starter','For small businesses, startups and small NGOs',799,7990,
 '["Up to 5 users","Purchase requisitions","Basic approval workflows","Supplier management","Invoice scanning","Basic reporting","5 GB document storage","Email support"]'::jsonb,
 5,5,1,true,false,false),
('PROFESSIONAL','Professional','For growing companies and NPOs',1999,19990,
 '["Up to 25 users","OCR invoice scanning","Approval workflows","Finance dashboard","Payment batching","Supplier portal","VAT tracking","Audit logs","Mobile access","50 GB storage","Priority support"]'::jsonb,
 25,50,2,true,false,true),
('BUSINESS','Business','For medium-sized organizations with multiple departments',4999,49990,
 '["Up to 100 users","Advanced analytics","Section 18A donation management","Donor fund tracking","Project allocation","Custom approval workflows","API access","Multi-branch support","250 GB storage","Dedicated onboarding"]'::jsonb,
 100,250,3,false,false,false),
('ENTERPRISE','Enterprise','For corporates, municipalities and large NGOs',9999,99990,
 '["Unlimited users","SSO (Azure AD/Google)","Custom integrations","Custom branding","SLA","Dedicated account manager","On-premise/private cloud options","Unlimited storage","Custom reports","Advanced security and compliance"]'::jsonb,
 NULL,NULL,4,true,true,false)
ON CONFLICT (code) DO NOTHING;
