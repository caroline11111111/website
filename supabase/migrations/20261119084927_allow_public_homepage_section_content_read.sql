create policy "site_settings_anon_homepage_section_content_read"
on public.site_settings
for select
to anon
using (setting_key = 'storefront_homepage_section_content');