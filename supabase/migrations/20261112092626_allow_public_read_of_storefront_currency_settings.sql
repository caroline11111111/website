CREATE POLICY site_settings_public_currency_read
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (setting_key = 'storefront_currency_settings');