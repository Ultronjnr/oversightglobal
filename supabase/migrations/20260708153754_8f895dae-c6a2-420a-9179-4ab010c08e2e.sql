ALTER TABLE public.fund_allocations ADD COLUMN IF NOT EXISTS expense_category text;
ALTER TABLE public.fund_allocations ADD COLUMN IF NOT EXISTS allocation_date date NOT NULL DEFAULT CURRENT_DATE;