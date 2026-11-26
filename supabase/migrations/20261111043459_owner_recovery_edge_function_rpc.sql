
create or replace function public.owner_recovery_verify_secret(p_secret text)
returns uuid language sql security definer set search_path=''
as $$ select app_private.verify_owner_recovery_secret(p_secret) $$;
revoke all on function public.owner_recovery_verify_secret(text) from public,anon,authenticated;
grant execute on function public.owner_recovery_verify_secret(text) to service_role;

create or replace function public.owner_recovery_log_password_reset(p_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from app_private.owner_principal where singleton=true and user_id=p_user_id) then raise exception 'Owner identity mismatch';end if;
 insert into app_private.owner_recovery_audit_logs(event_type,actor_user_id,details)
 values('recovery_password.reset',p_user_id,jsonb_build_object('password_reset',true));
end;
$$;
revoke all on function public.owner_recovery_log_password_reset(uuid) from public,anon,authenticated;
grant execute on function public.owner_recovery_log_password_reset(uuid) to service_role;
