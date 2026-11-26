
create or replace function app_private.enforce_media_slot_limit()
returns trigger language plpgsql set search_path=''
as $$
declare v_count integer;v_limit integer;
begin
 if tg_table_name='product_images' then
  v_limit:=5;
  select count(*) into v_count from public.product_images
  where product_id=new.product_id and (tg_op='INSERT' or id<>new.id);
 elsif tg_table_name='about_images' then
  v_limit:=10;
  select count(*) into v_count from public.about_images where tg_op='INSERT' or id<>new.id;
 elsif tg_table_name='homepage_slides' then
  v_limit:=5;
  select count(*) into v_count from public.homepage_slides where tg_op='INSERT' or id<>new.id;
 else
  v_limit:=5;
  select count(*) into v_count from public.homepage_banners where tg_op='INSERT' or id<>new.id;
 end if;
 if v_count>=v_limit then raise exception 'Maximum of % images allowed for %',v_limit,tg_table_name;end if;
 return new;
end;
$$;
