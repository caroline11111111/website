
create or replace function app_private.enforce_media_slot_limit()
returns trigger language plpgsql set search_path=''
as $$
declare v_count integer;v_limit integer;
begin
 if tg_table_name='product_images' then v_limit:=5;
 elsif tg_table_name='about_images' then v_limit:=10;
 else v_limit:=5;end if;
 execute format('select count(*) from public.%I where product_id=$1 and ($2 is null or id<>$2)',tg_table_name)
 into v_count using case when tg_table_name='product_images' then new.product_id else null end,
 case when tg_op='UPDATE' then new.id else null end;
 if v_count>=v_limit then raise exception 'Maximum of % images allowed for %',v_limit,tg_table_name;end if;
 return new;
end;
$$;
revoke all on function app_private.enforce_media_slot_limit() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['product_images','homepage_slides','homepage_banners','about_images'] loop
  execute format('drop trigger if exists enforce_media_slot_limit on public.%I',t);
  execute format('create trigger enforce_media_slot_limit before insert or update on public.%I for each row execute function app_private.enforce_media_slot_limit()',t);
 end loop;
end $$;
