-- STEP 1: Create ENUM types
CREATE TYPE public.pr_status AS ENUM (
  'PENDING_HOD_APPROVAL',
  'HOD_APPROVED',
  'HOD_DECLINED',
  'PENDING_FINANCE_APPROVAL',
  'FINANCE_APPROVED',
  'FINANCE_DECLINED',
  'SPLIT'
);

CREATE TYPE public.urgency_level AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

-- STEP 2: Create purchase_requisitions table
CREATE TABLE public.purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by_name TEXT NOT NULL,
  requested_by_department TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  urgency public.urgency_level NOT NULL DEFAULT 'NORMAL',
  hod_status TEXT NOT NULL DEFAULT 'Pending',
  finance_status TEXT NOT NULL DEFAULT 'Pending',
  status public.pr_status NOT NULL DEFAULT 'PENDING_HOD_APPROVAL',
  due_date DATE,
  payment_due_date DATE,
  document_url TEXT,
  parent_pr_id UUID REFERENCES public.purchase_requisitions(id) ON DELETE SET NULL,
  history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- STEP 3: Enable RLS
ALTER TABLE public.purchase_requisitions ENABLE ROW LEVEL SECURITY;

-- STEP 4: RLS Policies

-- Employees can INSERT PRs only for their organization
CREATE POLICY "Employees can create PRs for their organization"
ON public.purchase_requisitions
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND requested_by = auth.uid()
);

-- Employees can SELECT only PRs they created
CREATE POLICY "Employees can view their own PRs"
ON public.purchase_requisitions
FOR SELECT
TO authenticated
USING (
  requested_by = auth.uid()
);

-- HOD can SELECT PRs in their org pending HOD approval
CREATE POLICY "HOD can view PRs pending their approval"
ON public.purchase_requisitions
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'HOD')
  AND status = 'PENDING_HOD_APPROVAL'
);

-- Finance can SELECT PRs in their org pending finance approval
CREATE POLICY "Finance can view PRs pending their approval"
ON public.purchase_requisitions
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'FINANCE')
  AND status = 'PENDING_FINANCE_APPROVAL'
);

-- Admin has full SELECT access to organization PRs
CREATE POLICY "Admin can view all organization PRs"
ON public.purchase_requisitions
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN')
);

-- HOD can UPDATE PRs pending their approval (for approve/decline)
CREATE POLICY "HOD can update PRs pending their approval"
ON public.purchase_requisitions
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'HOD')
  AND status = 'PENDING_HOD_APPROVAL'
)
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
);

-- Finance can UPDATE PRs pending their approval (for approve/decline/split)
CREATE POLICY "Finance can update PRs pending their approval"
ON public.purchase_requisitions
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'FINANCE')
  AND status = 'PENDING_FINANCE_APPROVAL'
)
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
);

-- Admin can UPDATE any organization PR
CREATE POLICY "Admin can update organization PRs"
ON public.purchase_requisitions
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND has_role(auth.uid(), 'ADMIN')
)
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
);

-- STEP 5: Add updated_at trigger
CREATE TRIGGER update_purchase_requisitions_updated_at
BEFORE UPDATE ON public.purchase_requisitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_pr_organization_id ON public.purchase_requisitions(organization_id);
CREATE INDEX idx_pr_requested_by ON public.purchase_requisitions(requested_by);
CREATE INDEX idx_pr_status ON public.purchase_requisitions(status);