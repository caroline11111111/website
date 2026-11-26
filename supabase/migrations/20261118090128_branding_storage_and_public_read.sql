begin;

drop policy if exists site_settings_anon_branding_read on public.site_settings;
create policy site_settings_anon_branding_read
  on public.site_settings for select to anon
  using (setting_key='storefront_branding_settings');

drop policy if exists site_settings_authenticated_branding_read on public.site_settings;
create policy site_settings_authenticated_branding_read
  on public.site_settings for select to authenticated
  using (setting_key='storefront_branding_settings' or app_private.has_permission('settings.manage'));

drop policy if exists admins_manage_branding_logo on storage.objects;
create policy admins_manage_branding_logo
  on storage.objects for all to authenticated
  using (
    bucket_id='homepage-media'
    and (storage.foldername(name))[1]='branding'
    and app_private.has_permission('settings.manage')
  )
  with check (
    bucket_id='homepage-media'
    and (storage.foldername(name))[1]='branding'
    and app_private.has_permission('settings.manage')
  );

commit;
