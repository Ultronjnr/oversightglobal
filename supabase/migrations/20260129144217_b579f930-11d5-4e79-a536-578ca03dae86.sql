-- Fix 1: Improve validate_pr_items function with array length limit and required field checks
CREATE OR REPLACE FUNCTION public.validate_pr_items(items jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item JSONB;
  desc_text TEXT;
  qty NUMERIC;
  price NUMERIC;
  items_count INTEGER;
BEGIN
  -- Ensure items is an array
  IF jsonb_typeof(items) != 'array' THEN
    RAISE EXCEPTION 'Items must be an array';
  END IF;
  
  -- Check array length (max 100 items to prevent DoS)
  items_count := jsonb_array_length(items);
  IF items_count > 100 THEN
    RAISE EXCEPTION 'Too many items (max 100 allowed)';
  END IF;
  
  -- Ensure at least one item for valid PRs
  IF items_count = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Check required field: description must exist and not be empty
    desc_text := item->>'description';
    IF desc_text IS NULL OR trim(desc_text) = '' THEN
      RAISE EXCEPTION 'Item description is required';
    END IF;
    
    -- Check description length (max 500 characters)
    IF length(desc_text) > 500 THEN
      RAISE EXCEPTION 'Item description too long (max 500 characters)';
    END IF;
    
    -- Check required field: quantity must exist
    IF item->>'quantity' IS NULL THEN
      RAISE EXCEPTION 'Item quantity is required';
    END IF;
    
    -- Check quantity is positive
    qty := (item->>'quantity')::numeric;
    IF qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be positive';
    END IF;
    
    -- Check quantity is reasonable (max 1 million)
    IF qty > 1000000 THEN
      RAISE EXCEPTION 'Item quantity too large (max 1,000,000)';
    END IF;
    
    -- Check required field: unit_price must exist
    IF item->>'unit_price' IS NULL THEN
      RAISE EXCEPTION 'Item unit price is required';
    END IF;
    
    -- Check unit price is non-negative
    price := (item->>'unit_price')::numeric;
    IF price < 0 THEN
      RAISE EXCEPTION 'Item unit price cannot be negative';
    END IF;
    
    -- Check price is reasonable (max 1 billion)
    IF price > 1000000000 THEN
      RAISE EXCEPTION 'Item unit price too large';
    END IF;
  END LOOP;
  
  RETURN TRUE;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid numeric value in items';
END;
$function$;

-- Fix 2: Improve assign_invitation_role to verify invitation exists and is pending
CREATE OR REPLACE FUNCTION public.assign_invitation_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  valid_invitation RECORD;
  user_email TEXT;
BEGIN
    -- Get the user's email from profiles
    SELECT email INTO user_email
    FROM public.profiles
    WHERE id = _user_id;
    
    -- Verify there's a valid pending invitation for this user with matching role
    -- This prevents direct RPC calls from bypassing the invitation workflow
    SELECT * INTO valid_invitation
    FROM public.invitations
    WHERE LOWER(invitations.email) = LOWER(user_email)
    AND invitations.role = _role
    AND invitations.status = 'pending'
    AND invitations.expires_at > now()
    LIMIT 1;
    
    -- If no valid invitation found, check if it's a self-signup role
    IF valid_invitation IS NULL THEN
        -- Only allow EMPLOYEE and SUPPLIER for self-signup
        IF _role NOT IN ('EMPLOYEE', 'SUPPLIER') THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Insert the role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
    
    RETURN TRUE;
EXCEPTION
    WHEN unique_violation THEN
        -- Role already exists, which is fine
        RETURN TRUE;
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$function$;

-- Fix 3: Update storage policy for organization-scoped approver access
DROP POLICY IF EXISTS "Approvers can view org PR documents" ON storage.objects;

CREATE POLICY "Approvers can view org PR documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'pr-documents'
  AND (has_role(auth.uid(), 'HOD'::app_role) OR has_role(auth.uid(), 'FINANCE'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
  AND EXISTS (
    SELECT 1 FROM profiles p1, profiles p2
    WHERE p1.id = auth.uid()
    AND p2.id = ((storage.foldername(storage.objects.name))[1])::uuid
    AND p1.organization_id = p2.organization_id
  )
);