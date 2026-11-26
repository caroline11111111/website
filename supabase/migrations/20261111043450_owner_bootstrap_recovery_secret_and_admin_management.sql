
create or replace function app_private.bootstrap_first_owner(p_email text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid;v_admin_id uuid;v_role_id uuid;
begin
 if exists(select 1 from app_private.owner_principal where singleton=true) then raise exception 'Owner has already been established';end if;
 select id into v_user_id from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null order by created_at limit 1;
 if v_user_id is null then raise exception 'A confirmed Supabase Auth user with this email was not found';end if;
 insert into app_private.owner_principal(singleton,user_id,established_by) values(true,v_user_id,v_user_id);
 insert into public.admin_users(user_id,is_active) values(v_user_id,true) returning id into v_admin_id;
 select id into v_role_id from public.roles where name='Owner';
 if v_role_id is null then raise exception 'Owner role is missing';end if;
 insert into public.admin_user_roles(admin_user_id,role_id,assigned_by) values(v_admin_id,v_role_id,v_user_id);
 insert into public.role_permissions(role_id,permission_id,assigned_by)
 select v_role_id,id,v_user_id from public.permissions on conflict do nothing;
 insert into app_private.owner_recovery_credentials(singleton,secret_hash,failed_attempts)
 values(true,null,0) on conflict(singleton) do nothing;
 insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,new_values,reason)
 values(v_admin_id,v_user_id,'owner.bootstrap','owner_principal',v_user_id,jsonb_build_object('owner_established',true),'Initial one-time Owner bootstrap');
 return v_user_id;
end;
$$;
revoke all on function app_private.bootstrap_first_owner(text) from public,anon,authenticated;
grant execute on function app_private.bootstrap_first_owner(text) to service_role;

create or replace function public.set_owner_recovery_secret(p_secret text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not app_private.is_owner() then raise exception 'Only the current Owner may set the recovery secret';end if;
 if length(p_secret)<16 then raise exception 'Recovery secret must be at least 16 characters';end if;
 insert into app_private.owner_recovery_credentials(singleton,secret_hash,failed_attempts,locked_until,updated_at,last_used_at)
 values(true,extensions.crypt(p_secret,extensions.gen_salt('bf',12)),0,null,now(),null)
 on conflict(singleton) do update set secret_hash=excluded.secret_hash,failed_attempts=0,locked_until=null,updated_at=now();
 insert into app_private.owner_recovery_audit_logs(event_type,actor_user_id,details)
 values('recovery_secret.set',v_user,jsonb_build_object('secret_updated',true));
end;
$$;
revoke all on function public.set_owner_recovery_secret(text) from public,anon;
grant execute on function public.set_owner_recovery_secret(text) to authenticated;

create or replace function app_private.verify_owner_recovery_secret(p_secret text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_hash text;v_user uuid;v_failed integer;v_locked timestamptz;
begin
 select secret_hash,failed_attempts,locked_until into v_hash,v_failed,v_locked
 from app_private.owner_recovery_credentials where singleton=true for update;
 if v_hash is null then raise exception 'Owner recovery secret has not been configured';end if;
 if v_locked is not null and v_locked>now() then raise exception 'Owner recovery is temporarily locked';end if;
 select user_id into v_user from app_private.owner_principal where singleton=true;
 if extensions.crypt(p_secret,v_hash)=v_hash then
  update app_private.owner_recovery_credentials set failed_attempts=0,locked_until=null,last_used_at=now(),updated_at=now() where singleton=true;
  insert into app_private.owner_recovery_audit_logs(event_type,actor_user_id,details)
  values('recovery_secret.verified',v_user,jsonb_build_object('result','success'));
  return v_user;
 end if;
 v_failed:=v_failed+1;
 update app_private.owner_recovery_credentials set failed_attempts=v_failed,
  locked_until=case when v_failed>=5 then now()+interval '30 minutes' else null end,updated_at=now()
 where singleton=true;
 insert into app_private.owner_recovery_audit_logs(event_type,actor_user_id,details)
 values('recovery_secret.failed',null,jsonb_build_object('failed_attempts',v_failed));
 raise exception 'Invalid recovery secret';
end;
$$;
revoke all on function app_private.verify_owner_recovery_secret(text) from public,anon,authenticated;
grant execute on function app_private.verify_owner_recovery_secret(text) to service_role;

create or replace function public.list_admin_users()
returns table(user_id uuid,email text,is_active boolean,role_names text[])
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not app_private.has_permission('admins.manage') then raise exception 'Permission denied';end if;
 return query
 select au.user_id,u.email,au.is_active,coalesce(array_agg(r.name) filter(where r.name is not null),'{}'::text[])
 from public.admin_users au join auth.users u on u.id=au.user_id
 left join public.admin_user_roles aur on aur.admin_user_id=au.id
 left join public.roles r on r.id=aur.role_id
 group by au.user_id,u.email,au.is_active order by u.email;
end;
$$;
revoke all on function public.list_admin_users() from public,anon;
grant execute on function public.list_admin_users() to authenticated;

create or replace function public.set_admin_access_by_email(p_email text,p_active boolean,p_role_name text default 'Admin')
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid;v_admin_id uuid;
begin
 if auth.uid() is null or not app_private.has_permission('admins.manage') then raise exception 'Permission denied';end if;
 select id into v_user_id from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null order by created_at limit 1;
 if v_user_id is null then raise exception 'A confirmed account with this email was not found';end if;
 v_admin_id:=public.set_admin_access(v_user_id,p_active,p_role_name);
 return v_admin_id;
end;
$$;
revoke all on function public.set_admin_access_by_email(text,boolean,text) from public,anon;
grant execute on function public.set_admin_access_by_email(text,boolean,text) to authenticated;
