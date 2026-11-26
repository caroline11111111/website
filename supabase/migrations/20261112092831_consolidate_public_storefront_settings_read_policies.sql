DROP POLICY IF EXISTS site_settings_admin_read ON public.site_settings;
DROP POLICY IF EXISTS site_settings_public_colour_theme_read ON public.site_settings;
DROP POLICY IF EXISTS site_settings_public_whatsapp_read ON public.site_settings;
DROP POLICY IF EXISTS site_settings_public_currency_read ON public.site_settings;

CREATE POLICY site_settings_anon_storefront_read
ON public.site_settings
FOR SELECT
TO anon
USING (setting_key IN ('website_colour_theme','whatsapp_support_phone','storefront_currency_settings'));

CREATE POLICY site_settings_authenticated_read
ON public.site_settings
FOR SELECT
TO authenticated
USING (
  setting_key IN ('website_colour_theme','whatsapp_support_phone','storefront_currency_settings')
  OR app_private.has_permission('settings.manage')
);