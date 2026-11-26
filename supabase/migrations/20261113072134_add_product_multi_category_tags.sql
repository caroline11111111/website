create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

insert into public.product_categories (product_id, category_id)
select id, category_id
from public.products
where category_id is not null
on conflict do nothing;

alter table public.product_categories enable row level security;

grant select, insert, delete on public.product_categories to authenticated;
grant select on public.product_categories to anon;

drop policy if exists product_categories_public_read on public.product_categories;
create policy product_categories_public_read
on public.product_categories for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    join public.categories c on c.id = product_categories.category_id
    where p.id = product_categories.product_id
      and (
        (p.is_published and not p.is_archived and c.is_active)
        or app_private.has_permission('products.view')
      )
  )
);

drop policy if exists product_categories_insert_authorized on public.product_categories;
create policy product_categories_insert_authorized
on public.product_categories for insert
to authenticated
with check (
  app_private.has_permission('products.create')
  or app_private.has_permission('products.edit')
);

drop policy if exists product_categories_delete_authorized on public.product_categories;
create policy product_categories_delete_authorized
on public.product_categories for delete
to authenticated
using (
  app_private.has_permission('products.create')
  or app_private.has_permission('products.edit')
);

create index if not exists product_categories_category_id_idx
on public.product_categories(category_id);