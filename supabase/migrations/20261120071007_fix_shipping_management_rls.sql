-- Keep shipping administration restricted to active Admin/Owner accounts or users with the explicit permission.
create or replace function app_private.can_manage_shipping_rates()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_permission('shipping_rates.manage')
    or exists (
      select 1
      from public.admin_users au
      join public.admin_user_roles aur on aur.admin_user_id=au.id
      join public.roles r on r.id=aur.role_id
      where au.user_id=(select auth.uid())
        and au.is_active
        and r.name in ('Admin','Owner')
    );
$$;

revoke all on function app_private.can_manage_shipping_rates() from public, anon;
grant execute on function app_private.can_manage_shipping_rates() to authenticated;

drop policy if exists shipping_rates_insert_authorized on public.shipping_rates;
create policy shipping_rates_insert_authorized on public.shipping_rates
for insert to authenticated
with check (app_private.can_manage_shipping_rates());

drop policy if exists shipping_rates_update_authorized on public.shipping_rates;
create policy shipping_rates_update_authorized on public.shipping_rates
for update to authenticated
using (app_private.can_manage_shipping_rates())
with check (app_private.can_manage_shipping_rates());

drop policy if exists shipping_rates_delete_authorized on public.shipping_rates;
create policy shipping_rates_delete_authorized on public.shipping_rates
for delete to authenticated
using (app_private.can_manage_shipping_rates());

drop policy if exists shipping_zones_insert_authorized on public.shipping_zones;
create policy shipping_zones_insert_authorized on public.shipping_zones
for insert to authenticated
with check (app_private.can_manage_shipping_rates());

drop policy if exists shipping_zones_update_authorized on public.shipping_zones;
create policy shipping_zones_update_authorized on public.shipping_zones
for update to authenticated
using (app_private.can_manage_shipping_rates())
with check (app_private.can_manage_shipping_rates());

drop policy if exists shipping_zones_delete_authorized on public.shipping_zones;
create policy shipping_zones_delete_authorized on public.shipping_zones
for delete to authenticated
using (app_private.can_manage_shipping_rates());

drop policy if exists shipping_rate_currency_prices_manage on public.shipping_rate_currency_prices;
create policy shipping_rate_currency_prices_manage on public.shipping_rate_currency_prices
for all to authenticated
using (app_private.can_manage_shipping_rates())
with check (app_private.can_manage_shipping_rates());
