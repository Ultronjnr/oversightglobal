ALTER TABLE public.quote_requests DROP CONSTRAINT quote_requests_supplier_id_fkey;
ALTER TABLE public.quote_requests ADD CONSTRAINT quote_requests_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.quotes DROP CONSTRAINT quotes_supplier_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.quotes DROP CONSTRAINT quotes_quote_request_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_quote_request_id_fkey
  FOREIGN KEY (quote_request_id) REFERENCES public.quote_requests(id) ON DELETE CASCADE;