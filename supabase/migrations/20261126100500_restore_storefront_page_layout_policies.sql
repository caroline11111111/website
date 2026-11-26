-- Restore the Production storefront page layout table and its RLS policies.
-- The table and policies were present in Production but absent from the recovered
-- migration history. The table is recreated empty; no Production content is copied.

CREATE TABLE IF NOT EXISTS public.storefront_page_layouts (
  page_key text PRIMARY KEY CHECK (page_key = ANY (ARRAY['about'::text, 'banner'::text])),
  layout_json jsonb NOT NULL DEFAULT '{"blocks": [], "version": 1}'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.storefront_page_layouts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.storefront_page_layouts TO anon, authenticated;
GRANT INSERT, UPDATE ON public.storefront_page_layouts TO authenticated;

CREATE POLICY storefront_page_layouts_public_read
ON public.storefront_page_layouts
FOR SELECT
TO anon, authenticated
USING (
  is_published
  OR app_private.has_permission('content.manage')
);

CREATE POLICY storefront_page_layouts_admin_insert
ON public.storefront_page_layouts
FOR INSERT
TO authenticated
WITH CHECK (
  app_private.has_permission('content.manage')
);

CREATE POLICY storefront_page_layouts_admin_update
ON public.storefront_page_layouts
FOR UPDATE
TO authenticated
USING (
  app_private.has_permission('content.manage')
)
WITH CHECK (
  app_private.has_permission('content.manage')
);
