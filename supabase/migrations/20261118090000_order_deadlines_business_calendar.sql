
begin;

create extension if not exists pg_cron with schema pg_catalog;

create unique index if not exists customer_addresses_one_default_per_user
  on public.customer_addresses(user_id) where is_default = true;

alter table public.orders
  add column if not exists unpaid_deadline_at timestamptz,
  add column if not exists proof_review_deadline_at timestamptz,
  add column if not exists proof_resubmission_deadline_at timestamptz,
  add column if not exists current_deadline_at timestamptz,
  add column if not exists deadline_stage text not null default 'none',
  add column if not exists deadline_status text not null default 'inactive',
  add column if not exists deadline_calendar_version integer,
  add column if not exists deadline_last_reminder_at timestamptz,
  add column if not exists deadline_last_reminder_type text,
  add column if not exists deadline_reminder_count integer not null default 0;

alter table public.orders
  drop constraint if exists orders_deadline_stage_check,
  add constraint orders_deadline_stage_check
    check (deadline_stage in ('none','unpaid','proof_review','resubmission')),
  drop constraint if exists orders_deadline_status_check,
  add constraint orders_deadline_status_check
    check (deadline_status in ('inactive','active','paused','overdue','closed'));

alter table public.inventory_reservations
  add column if not exists original_deadline_at timestamptz,
  add column if not exists current_deadline_at timestamptz,
  add column if not exists deadline_stage text,
  add column if not exists deadline_calendar_version integer;

alter table public.payment_proofs
  add column if not exists review_deadline_at timestamptz,
  add column if not exists resubmit_deadline_at timestamptz;

create table if not exists public.business_calendar_meta (
  singleton boolean primary key default true check (singleton),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.business_calendar_meta(singleton,version)
values (true,1)
on conflict (singleton) do nothing;

create table if not exists public.business_calendar_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  holiday_name text not null,
  holiday_scope text not null check (holiday_scope in ('national','state')),
  region_label text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_deadline_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  reservation_id uuid references public.inventory_reservations(id) on delete restrict,
  payment_proof_id uuid references public.payment_proofs(id) on delete restrict,
  event_type text not null,
  deadline_stage text,
  old_deadline_at timestamptz,
  new_deadline_at timestamptz,
  calendar_version integer,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_permission text not null,
  notification_type text not null,
  notification_key text not null unique,
  title text not null,
  message text not null,
  order_id uuid references public.orders(id) on delete restrict,
  payment_proof_id uuid references public.payment_proofs(id) on delete restrict,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists order_deadline_history_order_created_idx
  on public.order_deadline_history(order_id,created_at desc);
create index if not exists orders_current_deadline_idx
  on public.orders(deadline_status,current_deadline_at)
  where deadline_status in ('active','overdue');
create index if not exists payment_proofs_pending_created_idx
  on public.payment_proofs(review_status,created_at)
  where review_status='pending';
create index if not exists admin_notifications_permission_created_idx
  on public.admin_notifications(recipient_permission,created_at desc);

alter table public.business_calendar_meta enable row level security;
alter table public.business_calendar_holidays enable row level security;
alter table public.order_deadline_history enable row level security;
alter table public.admin_notifications enable row level security;

drop policy if exists business_calendar_meta_read_authorized on public.business_calendar_meta;
create policy business_calendar_meta_read_authorized
  on public.business_calendar_meta for select to authenticated
  using (app_private.has_permission('settings.manage') or app_private.has_permission('orders.view'));

drop policy if exists business_calendar_holidays_read_authorized on public.business_calendar_holidays;
create policy business_calendar_holidays_read_authorized
  on public.business_calendar_holidays for select to authenticated
  using (app_private.has_permission('settings.manage') or app_private.has_permission('orders.view'));

drop policy if exists business_calendar_holidays_insert_authorized on public.business_calendar_holidays;
create policy business_calendar_holidays_insert_authorized
  on public.business_calendar_holidays for insert to authenticated
  with check (app_private.has_permission('settings.manage'));

drop policy if exists business_calendar_holidays_update_authorized on public.business_calendar_holidays;
create policy business_calendar_holidays_update_authorized
  on public.business_calendar_holidays for update to authenticated
  using (app_private.has_permission('settings.manage'))
  with check (app_private.has_permission('settings.manage'));

drop policy if exists business_calendar_holidays_delete_authorized on public.business_calendar_holidays;
create policy business_calendar_holidays_delete_authorized
  on public.business_calendar_holidays for delete to authenticated
  using (app_private.has_permission('settings.manage'));

drop policy if exists order_deadline_history_read_authorized on public.order_deadline_history;
create policy order_deadline_history_read_authorized
  on public.order_deadline_history for select to authenticated
  using (
    app_private.has_permission('orders.view')
    or app_private.has_permission('inventory.view')
    or app_private.has_permission('payments.review')
  );

drop policy if exists admin_notifications_read_authorized on public.admin_notifications;
create policy admin_notifications_read_authorized
  on public.admin_notifications for select to authenticated
  using (app_private.has_permission(recipient_permission));

grant select on public.business_calendar_meta to authenticated;
grant select,insert,update,delete on public.business_calendar_holidays to authenticated;
grant select on public.order_deadline_history to authenticated;
grant select on public.admin_notifications to authenticated;

insert into public.permissions(code,description)
values ('orders.deadline.extend','Extend or reopen an order payment or proof deadline with a recorded reason')
on conflict (code) do nothing;

create or replace function app_private.business_deadline(p_event_at timestamptz,p_business_days integer)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_date date := (coalesce(p_event_at,now()) at time zone 'Asia/Kuala_Lumpur')::date;
  v_count integer := 0;
begin
  if p_business_days < 1 then
    raise exception 'Business-day count must be at least 1';
  end if;
  loop
    v_date := v_date + 1;
    if extract(isodow from v_date) between 1 and 5
       and not exists (
         select 1 from public.business_calendar_holidays h
         where h.holiday_date=v_date and h.is_active
       ) then
      v_count := v_count + 1;
      exit when v_count >= p_business_days;
    end if;
  end loop;
  return (((v_date + 1)::timestamp) at time zone 'Asia/Kuala_Lumpur') - interval '1 second';
end;
$function$;

create or replace function app_private.business_calendar_version()
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((select m.version from public.business_calendar_meta m where m.singleton),1);
$function$;

create or replace function app_private.bump_business_calendar_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.business_calendar_meta
  set version=version+1,updated_at=now()
  where singleton=true;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$function$;

drop trigger if exists business_calendar_holidays_version on public.business_calendar_holidays;
create trigger business_calendar_holidays_version
after insert or update or delete on public.business_calendar_holidays
for each row execute function app_private.bump_business_calendar_version();

create or replace function app_private.reject_deadline_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Order deadline history is append-only';
end;
$function$;

drop trigger if exists order_deadline_history_immutable on public.order_deadline_history;
create trigger order_deadline_history_immutable
before update or delete on public.order_deadline_history
for each row execute function app_private.reject_deadline_history_mutation();

create or replace function app_private.initialize_order_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deadline timestamptz;
  v_version integer;
begin
  v_deadline := app_private.business_deadline(new.created_at,3);
  v_version := app_private.business_calendar_version();
  update public.orders
  set unpaid_deadline_at=v_deadline,
      current_deadline_at=v_deadline,
      deadline_stage='unpaid',
      deadline_status='active',
      deadline_calendar_version=v_version
  where id=new.id;
  insert into public.order_deadline_history(
    order_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,calendar_version,reason,event_metadata
  ) values (
    new.id,'unpaid_timer_started','unpaid',null,v_deadline,v_version,
    'Initial three-business-day payment window',
    jsonb_build_object('timezone','Asia/Kuala_Lumpur','business_days',3)
  );
  return new;
end;
$function$;

drop trigger if exists orders_initialize_deadline on public.orders;
create trigger orders_initialize_deadline
after insert on public.orders
for each row execute function app_private.initialize_order_deadline();

create or replace function app_private.sync_new_reservation_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id=new.order_id;
  update public.inventory_reservations
  set original_deadline_at=coalesce(original_deadline_at,v_order.unpaid_deadline_at,v_order.current_deadline_at),
      current_deadline_at=v_order.current_deadline_at,
      deadline_stage=v_order.deadline_stage,
      deadline_calendar_version=v_order.deadline_calendar_version
  where id=new.id;
  return new;
end;
$function$;

drop trigger if exists inventory_reservation_sync_deadline on public.inventory_reservations;
create trigger inventory_reservation_sync_deadline
after insert on public.inventory_reservations
for each row execute function app_private.sync_new_reservation_deadline();

create or replace function app_private.start_proof_review_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_deadline timestamptz;
  v_version integer;
begin
  if new.review_status <> 'pending' then return new; end if;
  select * into v_order from public.orders where id=new.order_id for update;
  if not found then raise exception 'Order for payment proof not found'; end if;
  v_deadline := app_private.business_deadline(new.created_at,3);
  v_version := app_private.business_calendar_version();
  update public.payment_proofs set review_deadline_at=v_deadline where id=new.id;

  update public.orders
  set proof_review_deadline_at=v_deadline,
      proof_resubmission_deadline_at=null,
      current_deadline_at=v_deadline,
      deadline_stage='proof_review',
      deadline_status='active',
      deadline_calendar_version=v_version,
      deadline_last_reminder_at=null,
      deadline_last_reminder_type=null,
      deadline_reminder_count=0
  where id=new.order_id;

  update public.inventory_reservations
  set original_deadline_at=coalesce(original_deadline_at,v_order.unpaid_deadline_at),
      current_deadline_at=v_deadline,
      deadline_stage='proof_review',
      deadline_calendar_version=v_version
  where order_id=new.order_id and status='reserved';

  insert into public.order_deadline_history(
    order_id,payment_proof_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,calendar_version,reason,event_metadata
  ) values (
    new.order_id,new.id,'proof_review_started','proof_review',v_order.current_deadline_at,v_deadline,v_version,
    'Payment proof submitted; unpaid timer paused and review timer started',
    jsonb_build_object('timezone','Asia/Kuala_Lumpur','business_days',3)
  );

  insert into public.admin_notifications(
    recipient_permission,notification_type,notification_key,title,message,order_id,payment_proof_id
  ) values (
    'payments.review','payment_proof_submitted','proof:'||new.id::text||':submitted',
    'New payment proof submitted',
    'A customer submitted payment proof. Review the order and receipt.',
    new.order_id,new.id
  ) on conflict (notification_key) do nothing;

  return new;
end;
$function$;

drop trigger if exists payment_proof_start_deadline on public.payment_proofs;
create trigger payment_proof_start_deadline
after insert on public.payment_proofs
for each row execute function app_private.start_proof_review_deadline();

create or replace function app_private.finish_or_restart_proof_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_deadline timestamptz;
  v_version integer;
  v_event text;
begin
  if old.review_status = new.review_status then return new; end if;
  select * into v_order from public.orders where id=new.order_id for update;
  if not found then raise exception 'Order for payment proof not found'; end if;
  v_version := app_private.business_calendar_version();

  if new.review_status='rejected' then
    v_deadline := app_private.business_deadline(coalesce(new.reviewed_at,now()),2);
    update public.payment_proofs set resubmit_deadline_at=v_deadline where id=new.id;
    update public.orders
    set proof_resubmission_deadline_at=v_deadline,
        current_deadline_at=v_deadline,
        deadline_stage='resubmission',
        deadline_status='active',
        deadline_calendar_version=v_version,
        deadline_last_reminder_at=null,
        deadline_last_reminder_type=null,
        deadline_reminder_count=0
    where id=new.order_id;
    update public.inventory_reservations
    set current_deadline_at=v_deadline,deadline_stage='resubmission',deadline_calendar_version=v_version
    where order_id=new.order_id and status='reserved';
    v_event := 'proof_resubmission_started';
  elsif new.review_status='approved' then
    update public.orders
    set current_deadline_at=null,deadline_stage='none',deadline_status='closed',
        deadline_calendar_version=v_version
    where id=new.order_id;
    update public.inventory_reservations
    set current_deadline_at=null,deadline_stage='none',deadline_calendar_version=v_version
    where order_id=new.order_id and status='reserved';
    v_deadline := null;
    v_event := 'proof_review_completed';
  else
    return new;
  end if;

  insert into public.order_deadline_history(
    order_id,payment_proof_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,calendar_version,reason,event_metadata
  ) values (
    new.order_id,new.id,v_event,
    case when new.review_status='rejected' then 'resubmission' else null end,
    v_order.current_deadline_at,v_deadline,v_version,
    case when new.review_status='rejected' then 'Payment proof rejected; customer has two business days to resubmit'
         else 'Payment proof approved; deadline timers closed' end,
    jsonb_build_object('timezone','Asia/Kuala_Lumpur','business_days',case when new.review_status='rejected' then 2 else 0 end)
  );

  return new;
end;
$function$;

drop trigger if exists payment_proof_review_deadline on public.payment_proofs;
create trigger payment_proof_review_deadline
after update of review_status on public.payment_proofs
for each row execute function app_private.finish_or_restart_proof_deadline();

create or replace function public.process_order_deadline_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today text := to_char(now() at time zone 'Asia/Kuala_Lumpur','YYYYMMDD');
begin
  update public.orders
  set deadline_status='overdue'
  where deadline_status='active'
    and deadline_stage in ('unpaid','proof_review','resubmission')
    and current_deadline_at is not null
    and current_deadline_at <= now()
    and order_status not in ('cancelled','completed');

  insert into public.admin_notifications(
    recipient_permission,notification_type,notification_key,title,message,order_id,payment_proof_id
  )
  select 'payments.review','payment_proof_two_day_reminder',
         'proof:'||p.id::text||':two-day',
         'Payment proof awaiting review',
         'A payment proof has been awaiting review for two business days.',
         p.order_id,p.id
  from public.payment_proofs p
  join public.orders o on o.id=p.order_id
  where p.review_status='pending'
    and app_private.business_deadline(p.created_at,2) <= now()
    and o.order_status not in ('cancelled','completed')
  on conflict (notification_key) do nothing;

  insert into public.admin_notifications(
    recipient_permission,notification_type,notification_key,title,message,order_id
  )
  select 'payments.review','order_deadline_reached',
         'order:'||o.id::text||':deadline:'||to_char(o.current_deadline_at at time zone 'Asia/Kuala_Lumpur','YYYYMMDDHH24MISS'),
         'Order deadline reached',
         'An order payment or proof deadline has passed. The order and stock reservation remain unchanged until an authorized person acts.',
         o.id
  from public.orders o
  where o.deadline_status='overdue'
    and o.current_deadline_at is not null
    and o.order_status not in ('cancelled','completed')
  on conflict (notification_key) do nothing;

  insert into public.admin_notifications(
    recipient_permission,notification_type,notification_key,title,message,order_id
  )
  select 'payments.review','order_deadline_daily_reminder',
         'order:'||o.id::text||':daily:'||v_today,
         'Unresolved overdue order',
         'This order remains unresolved and its inventory is still reserved. Review it and take an authorized manual action.',
         o.id
  from public.orders o
  where o.deadline_status='overdue'
    and o.current_deadline_at is not null
    and o.order_status not in ('cancelled','completed')
    and o.payment_status<>'verified'
  on conflict (notification_key) do nothing;
end;
$function$;

create or replace function public.mark_admin_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v_permission text;
begin
  select recipient_permission into v_permission
  from public.admin_notifications
  where id=p_notification_id
  for update;
  if not found or not app_private.has_permission(v_permission) then
    raise exception 'Permission denied';
  end if;
  update public.admin_notifications set read_at=now()
  where id=p_notification_id and read_at is null;
end;
$function$;

create or replace function public.extend_order_deadline(
  p_order_id uuid,
  p_new_deadline_date date,
  p_reason text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_order public.orders%rowtype;
  v_new_deadline timestamptz;
  v_version integer;
  v_event text;
begin
  if v_actor is null or not app_private.has_permission('orders.deadline.extend') then
    raise exception 'Permission denied: orders.deadline.extend is required';
  end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reason is required'; end if;
  if p_new_deadline_date is null then raise exception 'A new deadline date is required'; end if;
  if extract(isodow from p_new_deadline_date) not between 1 and 5
     or exists(select 1 from public.business_calendar_holidays h where h.holiday_date=p_new_deadline_date and h.is_active) then
    raise exception 'Choose an eligible business day in the Malaysia business calendar';
  end if;
  v_new_deadline := (((p_new_deadline_date + 1)::timestamp) at time zone 'Asia/Kuala_Lumpur') - interval '1 second';
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.order_status in ('cancelled','completed') then raise exception 'Order is closed or unavailable'; end if;
  if v_order.deadline_stage='none' or v_order.deadline_status='closed' or v_order.current_deadline_at is null then
    raise exception 'This order has no open deadline to extend or reopen';
  end if;
  if v_new_deadline<=now() or v_new_deadline<=v_order.current_deadline_at then
    raise exception 'The new deadline must be in the future and later than the current deadline';
  end if;
  v_version := app_private.business_calendar_version();
  v_event := case when v_order.deadline_status='overdue' then 'deadline_reopened' else 'deadline_extended' end;

  update public.orders
  set current_deadline_at=v_new_deadline,
      deadline_status='active',
      deadline_calendar_version=v_version,
      deadline_last_reminder_at=null,
      deadline_last_reminder_type=null,
      deadline_reminder_count=0,
      unpaid_deadline_at=case when deadline_stage='unpaid' then v_new_deadline else unpaid_deadline_at end,
      proof_review_deadline_at=case when deadline_stage='proof_review' then v_new_deadline else proof_review_deadline_at end,
      proof_resubmission_deadline_at=case when deadline_stage='resubmission' then v_new_deadline else proof_resubmission_deadline_at end
  where id=p_order_id;

  update public.inventory_reservations
  set current_deadline_at=v_new_deadline,deadline_calendar_version=v_version
  where order_id=p_order_id and status='reserved';

  insert into public.order_deadline_history(
    order_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,calendar_version,reason,actor_user_id,event_metadata
  ) values (
    p_order_id,v_event,v_order.deadline_stage,v_order.current_deadline_at,v_new_deadline,v_version,trim(p_reason),v_actor,
    jsonb_build_object('timezone','Asia/Kuala_Lumpur','manual_admin_action',true)
  );

  insert into public.admin_audit_logs(admin_user_id,actor_user_id,action,target_type,target_id,old_values,new_values,reason)
  select au.id,v_actor,'order.deadline.'||v_event,'order',p_order_id,
         jsonb_build_object('deadline',v_order.current_deadline_at,'status',v_order.deadline_status),
         jsonb_build_object('deadline',v_new_deadline,'status','active'),
         trim(p_reason)
  from public.admin_users au where au.user_id=v_actor;

  return v_new_deadline;
end;
$function$;

revoke all on function public.process_order_deadline_notifications() from public,anon,authenticated;
grant execute on function public.process_order_deadline_notifications() to service_role;
revoke all on function public.mark_admin_notification_read(uuid) from public,anon;
grant execute on function public.mark_admin_notification_read(uuid) to authenticated;
revoke all on function public.extend_order_deadline(uuid,date,text) from public,anon;
grant execute on function public.extend_order_deadline(uuid,date,text) to authenticated;

commit;
