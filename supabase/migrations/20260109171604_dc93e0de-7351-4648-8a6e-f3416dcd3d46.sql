-- Create quote status enum
DO $$ BEGIN
    CREATE TYPE quote_status AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create quote_requests table (Finance -> Supplier)
CREATE TABLE public.quote_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    pr_id UUID NOT NULL REFERENCES public.purchase_requisitions(id),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    requested_by UUID NOT NULL,
    message TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quotes table (Supplier -> Finance)
CREATE TABLE public.quotes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    pr_id UUID NOT NULL REFERENCES public.purchase_requisitions(id),
    amount NUMERIC NOT NULL,
    delivery_time TEXT,
    valid_until DATE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'SUBMITTED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Quote Requests RLS Policies
CREATE POLICY "Finance can create quote requests"
ON public.quote_requests FOR INSERT
WITH CHECK (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'FINANCE'::app_role)
);

CREATE POLICY "Finance can view their org quote requests"
ON public.quote_requests FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'FINANCE'::app_role)
);

CREATE POLICY "Finance can update quote requests"
ON public.quote_requests FOR UPDATE
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'FINANCE'::app_role)
);

CREATE POLICY "Suppliers can view their quote requests"
ON public.quote_requests FOR SELECT
USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
);

-- Quotes RLS Policies
CREATE POLICY "Suppliers can create quotes for their requests"
ON public.quotes FOR INSERT
WITH CHECK (
    supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
);

CREATE POLICY "Suppliers can view their own quotes"
ON public.quotes FOR SELECT
USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
);

CREATE POLICY "Finance can view quotes for their org"
ON public.quotes FOR SELECT
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'FINANCE'::app_role)
);

CREATE POLICY "Finance can update quotes for their org"
ON public.quotes FOR UPDATE
USING (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'FINANCE'::app_role)
);

-- Triggers for updated_at
CREATE TRIGGER update_quote_requests_updated_at
BEFORE UPDATE ON public.quote_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();