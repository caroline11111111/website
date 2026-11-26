
alter table public.inventory_reservations alter column product_id drop not null;
alter table public.inventory_movements alter column product_id drop not null;
alter table public.inventory_reservations add constraint inventory_reservations_exact_target
 check (((product_id is not null)::int + (variant_id is not null)::int)=1);
alter table public.inventory_movements add constraint inventory_movements_exact_target
 check (((product_id is not null)::int + (variant_id is not null)::int)=1);

create or replace function app_private.normalize_inventory_target()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.variant_id is not null then new.product_id:=null; end if;
 return new;
end;
$$;
revoke all on function app_private.normalize_inventory_target() from public,anon,authenticated;
drop trigger if exists inventory_reservation_target_guard on public.inventory_reservations;
create trigger inventory_reservation_target_guard before insert or update of product_id,variant_id on public.inventory_reservations
for each row execute function app_private.normalize_inventory_target();
drop trigger if exists inventory_movement_target_guard on public.inventory_movements;
create trigger inventory_movement_target_guard before insert or update of product_id,variant_id on public.inventory_movements
for each row execute function app_private.normalize_inventory_target();

drop policy if exists products_update_authorized on public.products;
create policy products_update_authorized on public.products for update to authenticated
 using (app_private.has_permission('products.edit'))
 with check (app_private.has_permission('products.edit'));

create or replace function public.archive_product(p_product_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_product public.products%rowtype;
begin
 if v_actor is null or not app_private.has_permission('products.archive') then raise exception 'Permission denied';end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Archive reason is required';end if;
 select * into v_product from public.products where id=p_product_id for update;
 if not found or v_product.is_archived then raise exception 'Product not found or already archived';end if;
 update public.products set is_archived=true,is_published=false,archived_at=now(),archived_by=v_actor,archive_reason=trim(p_reason),updated_at=now() where id=p_product_id;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
 select au.id,v_actor,'product.archive','product',p_product_id,jsonb_build_object('is_archived',false,'is_published',v_product.is_published),jsonb_build_object('is_archived',true,'is_published',false),trim(p_reason)
 from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.archive_product(uuid,text) from public,anon;
grant execute on function public.archive_product(uuid,text) to authenticated;

create or replace function public.restore_product(p_product_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_product public.products%rowtype;
begin
 if v_actor is null or not app_private.has_permission('products.restore') then raise exception 'Permission denied';end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Restore reason is required';end if;
 select * into v_product from public.products where id=p_product_id for update;
 if not found or not v_product.is_archived then raise exception 'Archived product not found';end if;
 update public.products set is_archived=false,archived_at=null,archived_by=null,archive_reason=null,is_published=false,updated_at=now() where id=p_product_id;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
 select au.id,v_actor,'product.restore','product',p_product_id,jsonb_build_object('is_archived',true),jsonb_build_object('is_archived',false,'is_published',false),trim(p_reason)
 from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.restore_product(uuid,text) from public,anon;
grant execute on function public.restore_product(uuid,text) to authenticated;

create or replace function public.adjust_inventory(
 p_product_id uuid,p_variant_id uuid,p_quantity_change integer,p_reason text,p_event_key text
)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_product public.products%rowtype;v_variant public.product_variants%rowtype;v_stock integer;v_reserved integer;
begin
 if v_actor is null or not app_private.has_permission('inventory.adjust') then raise exception 'Permission denied';end if;
 if nullif(trim(p_reason),'') is null or nullif(trim(p_event_key),'') is null or p_quantity_change=0 then raise exception 'Reason, event key and non-zero quantity change are required';end if;
 if (p_product_id is null)::int+(p_variant_id is null)::int<>1 then raise exception 'Select exactly one product or variant';end if;
 if exists(select 1 from public.inventory_movements where event_key=p_event_key) then raise exception 'This inventory event has already been recorded';end if;
 if p_variant_id is null then
  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'Product not found';end if;
  v_stock:=v_product.stock_quantity+p_quantity_change;v_reserved:=v_product.reserved_quantity;
  if v_stock<0 or v_stock<v_reserved then raise exception 'Adjustment would reduce stock below reserved quantity';end if;
  if v_product.inventory_mode='single_item' and v_stock>1 then raise exception 'Single-item inventory cannot exceed one';end if;
  update public.products set stock_quantity=v_stock,updated_at=now() where id=p_product_id;
 else
  select * into v_variant from public.product_variants where id=p_variant_id for update;
  if not found then raise exception 'Product variant not found';end if;
  v_stock:=v_variant.stock_quantity+p_quantity_change;v_reserved:=v_variant.reserved_quantity;
  if v_stock<0 or v_stock<v_reserved then raise exception 'Adjustment would reduce stock below reserved quantity';end if;
  update public.product_variants set stock_quantity=v_stock,updated_at=now() where id=p_variant_id;
 end if;
 insert into public.inventory_movements(product_id,variant_id,movement_type,quantity_change,reason,event_key,created_by)
 values(p_product_id,p_variant_id,'stock_adjustment',p_quantity_change,trim(p_reason),trim(p_event_key),v_actor);
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values,reason)
 select au.id,v_actor,'inventory.adjust','inventory_item',coalesce(p_product_id,p_variant_id),jsonb_build_object('quantity_change',p_quantity_change),trim(p_reason)
 from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.adjust_inventory(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.adjust_inventory(uuid,uuid,integer,text,text) to authenticated;

create or replace function public.create_admin_role(p_name text,p_description text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_id uuid;
begin
 if v_actor is null or not app_private.has_permission('roles.manage') then raise exception 'Permission denied';end if;
 if lower(trim(p_name))='owner' or nullif(trim(p_name),'') is null then raise exception 'This role name is reserved or invalid';end if;
 insert into public.roles(name,description,is_system_role) values(trim(p_name),p_description,false) returning id into v_id;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values)
 select au.id,v_actor,'role.create','role',v_id,jsonb_build_object('name',trim(p_name),'description',p_description)
 from public.admin_users au where au.user_id=v_actor;
 return v_id;
end;
$$;
revoke all on function public.create_admin_role(text,text) from public,anon;
grant execute on function public.create_admin_role(text,text) to authenticated;

create or replace function public.set_role_permission(p_role_id uuid,p_permission_code text,p_grant boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_role public.roles%rowtype;v_permission public.permissions%rowtype;
begin
 if v_actor is null or not app_private.has_permission('roles.manage') then raise exception 'Permission denied';end if;
 select * into v_role from public.roles where id=p_role_id for update;
 if not found then raise exception 'Role not found';end if;
 if v_role.name='Owner' and not app_private.is_owner() then raise exception 'Only Owner can manage the Owner role';end if;
 select * into v_permission from public.permissions where code=p_permission_code;
 if not found then raise exception 'Permission code is not registered';end if;
 if p_grant then
  insert into public.role_permissions(role_id,permission_id,assigned_by) values(p_role_id,v_permission.id,v_actor) on conflict do nothing;
 else
  delete from public.role_permissions where role_id=p_role_id and permission_id=v_permission.id;
 end if;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values)
 select au.id,v_actor,case when p_grant then 'role.permission.grant' else 'role.permission.revoke' end,'role',p_role_id,
  jsonb_build_object('permission',p_permission_code) from public.admin_users au where au.user_id=v_actor;
end;
$$;
revoke all on function public.set_role_permission(uuid,text,boolean) from public,anon;
grant execute on function public.set_role_permission(uuid,text,boolean) to authenticated;

create or replace function public.set_admin_access(p_target_user_id uuid,p_active boolean,p_role_name text default 'Admin')
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_admin_id uuid;v_role public.roles%rowtype;v_owner_user uuid;
begin
 if v_actor is null or not app_private.has_permission('admins.manage') then raise exception 'Permission denied';end if;
 if p_role_name='Owner' then raise exception 'Owner identity cannot be granted through routine admin management';end if;
 select user_id into v_owner_user from app_private.owner_principal where singleton=true;
 if p_target_user_id=v_owner_user and not app_private.is_owner() then raise exception 'Only Owner can manage Owner access';end if;
 select id into v_admin_id from public.admin_users where user_id=p_target_user_id for update;
 if v_admin_id is null then
  insert into public.admin_users(user_id,is_active) values(p_target_user_id,p_active) returning id into v_admin_id;
 else
  update public.admin_users set is_active=p_active,updated_at=now() where id=v_admin_id;
 end if;
 if p_active then
  select * into v_role from public.roles where name=p_role_name;
  if not found then raise exception 'Role does not exist';end if;
  if v_role.name='Owner' then raise exception 'Owner role assignment is protected';end if;
  insert into public.admin_user_roles(admin_user_id,role_id,assigned_by) values(v_admin_id,v_role.id,v_actor) on conflict do nothing;
 end if;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values)
 select au.id,v_actor,'admin.access.set','admin_user',v_admin_id,jsonb_build_object('is_active',p_active,'role',p_role_name)
 from public.admin_users au where au.user_id=v_actor;
 return v_admin_id;
end;
$$;
revoke all on function public.set_admin_access(uuid,boolean,text) from public,anon;
grant execute on function public.set_admin_access(uuid,boolean,text) to authenticated;
