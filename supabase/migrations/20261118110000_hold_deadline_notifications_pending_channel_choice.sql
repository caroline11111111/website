
begin;

insert into public.site_settings(setting_key,setting_value)
values('deadline_notification_settings',jsonb_build_object('channel','pending_confirmation'))
on conflict(setting_key) do nothing;

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
  v_channel text;
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

  select setting_value->>'channel' into v_channel
  from public.site_settings where setting_key='deadline_notification_settings';
  if v_channel='in_app' then
    insert into public.admin_notifications(
      recipient_permission,notification_type,notification_key,title,message,order_id,payment_proof_id
    ) values (
      'payments.review','payment_proof_submitted','proof:'||new.id::text||':submitted',
      'New payment proof submitted',
      'A customer submitted payment proof. Review the order and receipt.',
      new.order_id,new.id
    ) on conflict (notification_key) do nothing;
  end if;

  return new;
end;
$function$;

create or replace function public.process_order_deadline_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today text := to_char(now() at time zone 'Asia/Kuala_Lumpur','YYYYMMDD');
  v_channel text;
begin
  with newly_overdue as (
    update public.orders
    set deadline_status='overdue'
    where deadline_status='active'
      and deadline_stage in ('unpaid','proof_review','resubmission')
      and current_deadline_at is not null
      and current_deadline_at <= now()
      and order_status not in ('cancelled','completed')
    returning id,deadline_stage,current_deadline_at,deadline_calendar_version
  )
  insert into public.order_deadline_history(
    order_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,calendar_version,reason,event_metadata
  )
  select id,'deadline_overdue',deadline_stage,current_deadline_at,current_deadline_at,
         deadline_calendar_version,
         'Deadline passed. Order and inventory reservation remain unchanged pending authorized manual action.',
         jsonb_build_object('automatic_cancellation',false,'automatic_inventory_release',false)
  from newly_overdue;

  select setting_value->>'channel' into v_channel
  from public.site_settings where setting_key='deadline_notification_settings';
  if coalesce(v_channel,'pending_confirmation')<>'in_app' then
    return;
  end if;

  with notices as (
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
    on conflict (notification_key) do nothing
    returning order_id,payment_proof_id
  )
  insert into public.order_deadline_history(
    order_id,payment_proof_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,calendar_version,reason
  )
  select n.order_id,n.payment_proof_id,'proof_review_two_day_reminder','proof_review',
         o.current_deadline_at,o.current_deadline_at,o.deadline_calendar_version,
         'In-app reminder sent to staff after two business days awaiting proof review'
  from notices n join public.orders o on o.id=n.order_id;

  with notices as (
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
    on conflict (notification_key) do nothing
    returning order_id
  )
  insert into public.order_deadline_history(
    order_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,calendar_version,reason
  )
  select n.order_id,'deadline_notification_sent',o.deadline_stage,o.current_deadline_at,o.current_deadline_at,
         o.deadline_calendar_version,'In-app deadline notification sent to authorized staff'
  from notices n join public.orders o on o.id=n.order_id;

  with notices as (
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
    on conflict (notification_key) do nothing
    returning order_id
  )
  insert into public.order_deadline_history(
    order_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,calendar_version,reason
  )
  select n.order_id,'daily_unresolved_reminder','overdue',o.current_deadline_at,o.current_deadline_at,
         o.deadline_calendar_version,'Daily unresolved-order reminder sent to authorized staff'
  from notices n join public.orders o on o.id=n.order_id;
end;
$function$;

commit;
