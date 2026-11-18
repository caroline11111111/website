
begin;

drop policy if exists order_deadline_history_read_authorized on public.order_deadline_history;
create policy order_deadline_history_read_authorized
  on public.order_deadline_history for select to authenticated
  using (
    app_private.has_permission('orders.view')
    or app_private.has_permission('inventory.view')
    or app_private.has_permission('inventory.release')
    or app_private.has_permission('orders.deadline.extend')
    or app_private.has_permission('payments.review')
  );

create or replace function public.list_inventory_reservations()
returns table(
  id uuid,
  order_id uuid,
  order_number text,
  order_status text,
  payment_status text,
  order_deadline_stage text,
  deadline_status text,
  order_current_deadline_at timestamptz,
  quantity integer,
  reservation_status text,
  reserved_at timestamptz,
  original_deadline_at timestamptz,
  current_deadline_at timestamptz,
  deadline_stage text,
  deadline_calendar_version integer,
  item_name text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not (
    app_private.has_permission('inventory.view')
    or app_private.has_permission('inventory.release')
    or app_private.has_permission('orders.deadline.extend')
  ) then
    raise exception 'Permission denied';
  end if;
  return query
  select
    ir.id,ir.order_id,o.order_number,o.order_status,o.payment_status,
    o.deadline_stage,o.deadline_status,o.current_deadline_at,
    ir.quantity,ir.status,ir.reserved_at,ir.original_deadline_at,
    ir.current_deadline_at,ir.deadline_stage,ir.deadline_calendar_version,
    coalesce(p.name,concat_ws(' ',pv.variant_name,pv.variant_value),'Inventory item')
  from public.inventory_reservations ir
  join public.orders o on o.id=ir.order_id
  left join public.products p on p.id=ir.product_id
  left join public.product_variants pv on pv.id=ir.variant_id
  where ir.status='reserved'
  order by ir.reserved_at desc
  limit 100;
end;
$function$;

revoke all on function public.list_inventory_reservations() from public,anon;
grant execute on function public.list_inventory_reservations() to authenticated;

commit;
