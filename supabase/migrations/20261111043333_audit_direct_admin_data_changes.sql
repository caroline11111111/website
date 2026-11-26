
create or replace function app_private.audit_admin_row_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_id uuid;v_action text;
begin
 if tg_op='INSERT' then v_id:=coalesce((to_jsonb(new)->>'id')::uuid,null);v_action:=lower(tg_table_name)||'.create';
 elsif tg_op='UPDATE' then v_id:=coalesce((to_jsonb(new)->>'id')::uuid,null);v_action:=lower(tg_table_name)||'.update';
 else v_id:=coalesce((to_jsonb(old)->>'id')::uuid,null);v_action:=lower(tg_table_name)||'.delete';end if;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values)
 select au.id,v_actor,v_action,tg_table_name,v_id,
  case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
  case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
 from (select 1) seed left join public.admin_users au on au.user_id=v_actor;
 if tg_op='DELETE' then return old;else return new;end if;
end;
$$;
revoke all on function app_private.audit_admin_row_change() from public,anon,authenticated;

do $$
declare t text;
begin
 foreach t in array array['products','product_variants','product_images','brands','categories','homepage_slides','homepage_banners','about_images','site_settings','shipping_zones','shipping_rates'] loop
  execute format('drop trigger if exists audit_admin_row_change on public.%I',t);
  execute format('create trigger audit_admin_row_change after insert or update or delete on public.%I for each row execute function app_private.audit_admin_row_change()',t);
 end loop;
end $$;
