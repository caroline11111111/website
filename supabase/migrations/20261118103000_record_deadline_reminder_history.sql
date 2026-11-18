
create or replace function public.process_order_deadline_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today text := to_char(now() at time zone 'Asia/Kuala_Lumpur','YYYYMMDD');
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

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='order-deadline-notifications';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'order-deadline-notifications',
    '*/15 * * * *',
    'select public.process_order_deadline_notifications();'
  );
end;
$$;
