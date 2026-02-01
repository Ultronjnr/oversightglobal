-- Create invoices table for tracking supplier invoices
CREATE TABLE public.invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_id UUID NOT NULL UNIQUE REFERENCES public.quotes(id) ON DELETE CASCADE,
    pr_id UUID NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    document_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'UPLOADED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    CONSTRAINT invoices_status_check CHECK (status IN ('UPLOADED', 'AWAITING_PAYMENT', 'PAID'))
);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Suppliers can create invoices for their accepted quotes
CREATE POLICY "Suppliers can create invoices for accepted quotes"
ON public.invoices FOR INSERT
WITH CHECK (
    supplier_id IN (
        SELECT s.id FROM public.suppliers s WHERE s.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.quotes q 
        WHERE q.id = invoices.quote_id 
        AND q.status = 'ACCEPTED'
        AND q.supplier_id = invoices.supplier_id
    )
);

-- Suppliers can view their own invoices
CREATE POLICY "Suppliers can view their own invoices"
ON public.invoices FOR SELECT
USING (
    supplier_id IN (
        SELECT s.id FROM public.suppliers s WHERE s.user_id = auth.uid()
    )
);

-- Finance can view invoices for their organization
CREATE POLICY "Finance can view org invoices"
ON public.invoices FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'FINANCE')
);

-- Finance can update invoice status (for payment processing)
CREATE POLICY "Finance can update org invoices"
ON public.invoices FOR UPDATE
USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'FINANCE')
);

-- Admin can view all org invoices
CREATE POLICY "Admin can view org invoices"
ON public.invoices FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'ADMIN')
);

-- Create trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for invoice documents
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-documents', 'invoice-documents', false);

-- Storage policies for invoice-documents bucket
-- Suppliers can upload their own invoices
CREATE POLICY "Suppliers can upload invoice documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'invoice-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Suppliers can view their own invoice documents
CREATE POLICY "Suppliers can view their invoice documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'invoice-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Finance can view all invoice documents in their org via document_url lookup
CREATE POLICY "Finance can view org invoice documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'invoice-documents'
    AND has_role(auth.uid(), 'FINANCE')
    AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.document_url = name
        AND i.organization_id = get_user_organization(auth.uid())
    )
);

-- Admin can view all invoice documents in their org
CREATE POLICY "Admin can view org invoice documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'invoice-documents'
    AND has_role(auth.uid(), 'ADMIN')
    AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.document_url = name
        AND i.organization_id = get_user_organization(auth.uid())
    )
);

-- Create function to accept a quote and reject all others for the same PR
CREATE OR REPLACE FUNCTION public.accept_quote_and_reject_others(
    _quote_id UUID,
    _pr_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _caller_org_id UUID;
    _quote_record RECORD;
BEGIN
    -- Get caller's organization
    _caller_org_id := get_user_organization(auth.uid());
    
    -- Verify caller is Finance
    IF NOT has_role(auth.uid(), 'FINANCE') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only Finance can accept quotes');
    END IF;
    
    -- Get and verify the quote
    SELECT * INTO _quote_record
    FROM public.quotes
    WHERE id = _quote_id
    AND pr_id = _pr_id
    AND organization_id = _caller_org_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
    END IF;
    
    IF _quote_record.status != 'SUBMITTED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quote is not in a state that can be accepted');
    END IF;
    
    -- Check if another quote for this PR is already accepted
    IF EXISTS (
        SELECT 1 FROM public.quotes
        WHERE pr_id = _pr_id
        AND status = 'ACCEPTED'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'A quote for this PR has already been accepted');
    END IF;
    
    -- Accept the selected quote
    UPDATE public.quotes
    SET status = 'ACCEPTED', updated_at = now()
    WHERE id = _quote_id;
    
    -- Reject all other quotes for the same PR
    UPDATE public.quotes
    SET status = 'REJECTED', updated_at = now()
    WHERE pr_id = _pr_id
    AND id != _quote_id
    AND status = 'SUBMITTED';
    
    RETURN jsonb_build_object('success', true, 'accepted_quote_id', _quote_id);
END;
$$;

-- Update prevent_accepted_quote_changes trigger function
CREATE OR REPLACE FUNCTION public.prevent_accepted_quote_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Once accepted, only invoice-related status changes are allowed
    IF OLD.status = 'ACCEPTED' THEN
        -- Allow status change to track invoice progress but keep quote locked
        IF NEW.status NOT IN ('ACCEPTED', 'INVOICE_UPLOADED', 'AWAITING_PAYMENT', 'COMPLETED') THEN
            RAISE EXCEPTION 'Cannot modify an accepted quote';
        END IF;
        -- Prevent changes to financial details
        IF NEW.amount != OLD.amount OR NEW.delivery_time IS DISTINCT FROM OLD.delivery_time THEN
            RAISE EXCEPTION 'Cannot modify financial details of an accepted quote';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS prevent_accepted_quote_changes_trigger ON public.quotes;
CREATE TRIGGER prevent_accepted_quote_changes_trigger
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_accepted_quote_changes();

-- Enable realtime for quotes table to enable supplier notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;