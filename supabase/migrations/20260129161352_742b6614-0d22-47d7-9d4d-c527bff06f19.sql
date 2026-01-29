-- Change suppliers.is_verified default to TRUE for auto-verification on signup
ALTER TABLE public.suppliers 
ALTER COLUMN is_verified SET DEFAULT true;