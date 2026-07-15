
UPDATE public.subscription_plans SET
  code = 'PLATFORM',
  name = 'Platform',
  description = 'For NPOs that run their own books — or whose accountant works straight off their Ovasyt data.',
  price_monthly = 1999,
  price_annual = 19990,
  user_limit = 5,
  storage_gb = 10,
  is_recommended = false,
  is_custom = false,
  is_public = true,
  is_active = true,
  tier = 1,
  features = '["5 users (Admin, Finance Manager, HOD, Team Member)","Full approval chain: Request → Approve → Invoice → Paid","Invoice scanning (150/month)","SARS tax invoice validation","Project & donor fund tracking","30 donor profiles","Donor Reports","Project Reports","Supplier portal","Invite up to 50 suppliers","Request & receive quotes inside Ovasyt","Section 18A receipt generation (50/year)","10 GB storage","Standard audit trail"]'::jsonb
WHERE code = 'STARTER';

UPDATE public.subscription_plans SET
  code = 'FUNDER_READY',
  name = 'Funder-Ready',
  description = 'Everything in Platform — plus we carry your compliance. Never think about SARS or year-end again.',
  price_monthly = 5998,
  price_annual = 59980,
  user_limit = 10,
  storage_gb = 25,
  is_recommended = true,
  is_custom = false,
  is_public = true,
  is_active = true,
  tier = 2,
  features = '["Everything in Platform","10 users","Unlimited donor profiles","150 supplier accounts","Invoice scanning (300/month)","25 GB storage","Unlimited Section 18A receipts","Monthly bookkeeping","Independently reviewed Annual Financial Statements","Income tax submissions","Priority support","Guided onboarding","Staff training"]'::jsonb
WHERE code = 'PROFESSIONAL';

UPDATE public.subscription_plans SET
  is_public = false,
  is_active = false
WHERE code = 'BUSINESS';

UPDATE public.subscription_plans SET
  code = 'TAILORED',
  name = 'Tailored',
  description = 'For NPO networks, federations and multi-entity organisations with complex funder requirements.',
  price_monthly = 0,
  price_annual = 0,
  user_limit = NULL,
  storage_gb = NULL,
  is_recommended = false,
  is_custom = true,
  is_public = true,
  is_active = true,
  tier = 3,
  features = '["Unlimited users","Multi-entity support","Custom approval logic","Reviewed or audited AFS","Priority processing","Dedicated account manager","Supplier accounts as agreed","Custom storage","Custom integrations"]'::jsonb
WHERE code = 'ENTERPRISE';
