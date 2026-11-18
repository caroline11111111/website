begin;
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='order-deadline-notifications';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'order-deadline-notifications',
    '15 * * * *',
    'select public.process_order_deadline_notifications();'
  );
end;
$$;
commit;
