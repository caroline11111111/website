-- Correct privileges on the already-created test/replay table.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.storefront_page_layouts FROM anon, authenticated, service_role;
GRANT SELECT ON public.storefront_page_layouts TO anon, authenticated;
GRANT INSERT, UPDATE ON public.storefront_page_layouts TO authenticated;
