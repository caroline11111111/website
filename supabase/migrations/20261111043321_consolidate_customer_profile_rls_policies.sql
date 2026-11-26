
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_read_own_or_customer_admin on public.profiles for select to authenticated
 using (id=(select auth.uid()) or app_private.has_permission('customers.view'));

drop policy if exists addresses_own_all on public.customer_addresses;
drop policy if exists customer_addresses_admin_read on public.customer_addresses;
create policy addresses_read_own_or_customer_admin on public.customer_addresses for select to authenticated
 using (user_id=(select auth.uid()) or app_private.has_permission('customers.view'));
create policy addresses_insert_own on public.customer_addresses for insert to authenticated
 with check (user_id=(select auth.uid()));
create policy addresses_update_own on public.customer_addresses for update to authenticated
 using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy addresses_delete_own on public.customer_addresses for delete to authenticated
 using (user_id=(select auth.uid()));
