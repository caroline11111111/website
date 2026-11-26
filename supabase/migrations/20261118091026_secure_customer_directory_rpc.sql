
create or replace function public.list_customer_directory()
returns table(
  customer_id uuid,
  email text,
  display_name text,
  phone text,
  created_at timestamptz,
  default_address jsonb,
  order_count bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not app_private.has_permission('customers.view') then
    raise exception 'Permission denied: customers.view is required';
  end if;
  return query
  select
    u.id,
    u.email::text,
    p.display_name,
    coalesce(p.phone,p.whatsapp),
    u.created_at,
    (
      select to_jsonb(ca)
      from public.customer_addresses ca
      where ca.user_id=u.id and ca.is_default
      order by ca.created_at desc
      limit 1
    ),
    (select count(*) from public.orders o where o.user_id=u.id)
  from auth.users u
  left join public.profiles p on p.id=u.id
  where not exists(select 1 from public.admin_users au where au.user_id=u.id)
  order by u.created_at desc
  limit 200;
end;
$function$;

revoke all on function public.list_customer_directory() from public,anon;
grant execute on function public.list_customer_directory() to authenticated;
