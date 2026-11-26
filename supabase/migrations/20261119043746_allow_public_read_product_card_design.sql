create policy site_settings_anon_product_card_design_read
on public.site_settings
for select
to anon
using (setting_key = 'product_card_design');