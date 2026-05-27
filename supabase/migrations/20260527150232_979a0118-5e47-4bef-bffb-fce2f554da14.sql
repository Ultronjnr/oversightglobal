CREATE UNIQUE INDEX IF NOT EXISTS organizations_company_email_unique_lower
ON public.organizations (lower(company_email))
WHERE company_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_lower
ON public.profiles (lower(email));

CREATE OR REPLACE FUNCTION public.complete_company_registration(
  _user_id uuid,
  _email text,
  _name text,
  _surname text,
  _phone text,
  _organization_id uuid,
  _company_name text,
  _company_address text,
  _registration_number text,
  _tax_number text,
  _company_type public.company_type,
  _vat_registered boolean,
  _vat_number text DEFAULT NULL,
  _vat_cycle public.vat_cycle DEFAULT NULL,
  _next_vat_submission_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_email text := lower(trim(coalesce(_email, '')));
  clean_name text := trim(coalesce(_name, ''));
  clean_surname text := trim(coalesce(_surname, ''));
  clean_phone text := nullif(trim(coalesce(_phone, '')), '');
  clean_company_name text := trim(coalesce(_company_name, ''));
  clean_company_address text := trim(coalesce(_company_address, ''));
  clean_registration_number text := trim(coalesce(_registration_number, ''));
  clean_tax_number text := trim(coalesce(_tax_number, ''));
  clean_vat_number text := nullif(trim(coalesce(_vat_number, '')), '');
  target_org_id uuid;
  existing_profile_org_id uuid;
  existing_org_id uuid;
  org_has_other_profile boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'You must be signed in to complete registration.' USING ERRCODE = '42501';
  END IF;

  IF normalized_email = '' OR normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Please enter a valid company email address.' USING ERRCODE = '22023';
  END IF;

  IF length(clean_name) < 2 OR length(clean_surname) < 2 THEN
    RAISE EXCEPTION 'First name and surname are required.' USING ERRCODE = '22023';
  END IF;

  IF length(clean_company_name) < 2 THEN
    RAISE EXCEPTION 'Company name is required.' USING ERRCODE = '22023';
  END IF;

  IF length(clean_company_address) < 5 THEN
    RAISE EXCEPTION 'Company address is required.' USING ERRCODE = '22023';
  END IF;

  IF length(clean_registration_number) < 2 OR length(clean_tax_number) < 2 THEN
    RAISE EXCEPTION 'Registration number and tax number are required.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(_vat_registered, false) AND (clean_vat_number IS NULL OR _vat_cycle IS NULL OR _next_vat_submission_date IS NULL) THEN
    RAISE EXCEPTION 'VAT number, VAT cycle, and next VAT submission date are required when VAT registered is enabled.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(p.email) = normalized_email
      AND p.id <> _user_id
  ) THEN
    RAISE EXCEPTION 'This email is already registered. Please log in or use a different email.' USING ERRCODE = '23505';
  END IF;

  SELECT p.organization_id INTO existing_profile_org_id
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF existing_profile_org_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = existing_profile_org_id) THEN
      IF public.has_role(_user_id, 'ADMIN'::public.app_role) THEN
        RETURN jsonb_build_object(
          'success', true,
          'organization_id', existing_profile_org_id,
          'status', 'already_registered'
        );
      END IF;

      IF public.organization_has_admin(existing_profile_org_id) THEN
        RAISE EXCEPTION 'This account is already linked to an organization. Please log in.' USING ERRCODE = '23505';
      END IF;

      target_org_id := existing_profile_org_id;
    ELSE
      UPDATE public.profiles
      SET organization_id = NULL,
          updated_at = now()
      WHERE id = _user_id;
    END IF;
  END IF;

  IF target_org_id IS NULL THEN
    SELECT o.id INTO existing_org_id
    FROM public.organizations o
    WHERE lower(o.company_email) = normalized_email
    LIMIT 1;

    IF existing_org_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.organization_id = existing_org_id
          AND p.id <> _user_id
      ) INTO org_has_other_profile;

      IF org_has_other_profile THEN
        RAISE EXCEPTION 'A company with this email already exists.' USING ERRCODE = '23505';
      END IF;

      target_org_id := existing_org_id;
    ELSE
      target_org_id := coalesce(_organization_id, gen_random_uuid());

      INSERT INTO public.organizations (
        id,
        name,
        company_email,
        address,
        registration_number,
        tax_number
      ) VALUES (
        target_org_id,
        clean_company_name,
        normalized_email,
        clean_company_address,
        clean_registration_number,
        clean_tax_number
      );
    END IF;
  END IF;

  UPDATE public.organizations
  SET name = clean_company_name,
      company_email = normalized_email,
      address = clean_company_address,
      registration_number = clean_registration_number,
      tax_number = clean_tax_number
  WHERE id = target_org_id;

  INSERT INTO public.profiles (
    id,
    email,
    name,
    surname,
    organization_id,
    phone,
    status,
    tier,
    updated_at
  ) VALUES (
    _user_id,
    normalized_email,
    clean_name,
    clean_surname,
    target_org_id,
    clean_phone,
    'ACTIVE'::public.user_status,
    'ADMIN'::public.subscription_tier,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = EXCLUDED.name,
      surname = EXCLUDED.surname,
      organization_id = EXCLUDED.organization_id,
      phone = EXCLUDED.phone,
      status = EXCLUDED.status,
      tier = EXCLUDED.tier,
      updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'ADMIN'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.freemium_business_profiles (
    user_id,
    full_name,
    company_name,
    registration_number,
    company_type,
    vat_registered,
    vat_number,
    vat_cycle,
    next_vat_submission_date,
    updated_at
  ) VALUES (
    _user_id,
    trim(clean_name || ' ' || clean_surname),
    clean_company_name,
    clean_registration_number,
    _company_type,
    coalesce(_vat_registered, false),
    CASE WHEN coalesce(_vat_registered, false) THEN clean_vat_number ELSE NULL END,
    CASE WHEN coalesce(_vat_registered, false) THEN _vat_cycle ELSE NULL END,
    CASE WHEN coalesce(_vat_registered, false) THEN _next_vat_submission_date ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      company_name = EXCLUDED.company_name,
      registration_number = EXCLUDED.registration_number,
      company_type = EXCLUDED.company_type,
      vat_registered = EXCLUDED.vat_registered,
      vat_number = EXCLUDED.vat_number,
      vat_cycle = EXCLUDED.vat_cycle,
      next_vat_submission_date = EXCLUDED.next_vat_submission_date,
      updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', target_org_id,
    'status', 'registered'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_company_registration(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  public.company_type,
  boolean,
  text,
  public.vat_cycle,
  date
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_company_registration(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  public.company_type,
  boolean,
  text,
  public.vat_cycle,
  date
) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_company_registration(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  public.company_type,
  boolean,
  text,
  public.vat_cycle,
  date
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_company_registration(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  public.company_type,
  boolean,
  text,
  public.vat_cycle,
  date
) TO service_role;