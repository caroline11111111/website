
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  phone text,
  whatsapp text,
  preferred_language text not null default 'en' check (preferred_language in ('en','zh')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  recipient_name text not null,
  phone text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state_region text,
  postal_code text,
  country_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customer_addresses_one_default_per_user
  on public.customer_addresses(user_id) where is_default;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_path text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_id uuid references public.brands(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  description text,
  price_myr numeric(12,2) not null check (price_myr >= 0),
  condition text,
  color text,
  specifications jsonb not null default '{}'::jsonb,
  sku text not null,
  inventory_mode text not null default 'single_item' check (inventory_mode in ('single_item','multiple')),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= stock_quantity),
  is_published boolean not null default false,
  sold_out_display text not null default 'show' check (sold_out_display in ('show','hide')),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inventory_mode <> 'single_item' or stock_quantity <= 1),
  check (not is_archived or not is_published)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  variant_name text not null,
  variant_value text not null,
  sku text not null,
  price_myr numeric(12,2) not null check (price_myr >= 0),
  weight_grams integer not null default 0 check (weight_grams >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= stock_quantity),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, variant_name, variant_value)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  storage_path text not null,
  alt_text text,
  display_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists product_images_one_primary
  on public.product_images(product_id) where is_primary;

create table if not exists public.homepage_slides (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_path text not null,
  mobile_image_path text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  image_path text not null,
  mobile_image_path text,
  link_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.about_images (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_path text not null,
  alt_text text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  cart_status text not null default 'active' check (cart_status in ('active','checked_out','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists carts_one_active_per_user
  on public.carts(user_id) where cart_status = 'active';

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((variant_id is null) or (variant_id is not null))
);
create unique index if not exists cart_items_product_without_variant
  on public.cart_items(cart_id, product_id) where variant_id is null;
create unique index if not exists cart_items_product_with_variant
  on public.cart_items(cart_id, product_id, variant_id) where variant_id is not null;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  recipient_name text not null,
  recipient_phone text not null,
  shipping_address jsonb not null,
  subtotal_myr numeric(12,2) not null check (subtotal_myr >= 0),
  shipping_fee_myr numeric(12,2) not null check (shipping_fee_myr >= 0),
  total_myr numeric(12,2) not null check (total_myr = subtotal_myr + shipping_fee_myr),
  order_status text not null default 'pending' check (order_status in ('pending','processing','shipped','completed','cancelled')),
  payment_status text not null default 'verification_pending' check (payment_status in ('verification_pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  brand_name text,
  product_image text,
  variant_snapshot jsonb,
  unit_price_myr numeric(12,2) not null check (unit_price_myr >= 0),
  quantity integer not null check (quantity > 0),
  line_total_myr numeric(12,2) not null check (line_total_myr = unit_price_myr * quantity),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','application/pdf')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  submission_number integer not null check (submission_number > 0),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  unique(order_id, submission_number)
);
create index if not exists payment_proofs_order_created_idx on public.payment_proofs(order_id, created_at desc);

create table if not exists public.payment_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_proof_id uuid references public.payment_proofs(id) on delete set null,
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved','consumed','released')),
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  reservation_id uuid references public.inventory_reservations(id) on delete restrict,
  movement_type text not null check (movement_type in ('stock_in','stock_adjustment','reserve','release','consume')),
  quantity_change integer not null,
  reason text not null,
  event_key text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_submission_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_status text not null default 'processing' check (request_status in ('processing','completed','failed')),
  order_id uuid references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id, idempotency_key)
);

create table if not exists public.order_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  request_reason text not null,
  request_status text not null default 'pending' check (request_status in ('pending','approved','rejected','executed')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  executed_by uuid references auth.users(id) on delete set null,
  executed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_pending_cancellation_per_order
  on public.order_cancellation_requests(order_id) where request_status = 'pending';

create table if not exists public.order_shipping_change_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  original_recipient_name text not null,
  original_recipient_phone text not null,
  original_shipping_address jsonb not null,
  requested_recipient_name text not null,
  requested_recipient_phone text not null,
  requested_shipping_address jsonb not null,
  customer_reason text,
  request_status text not null default 'pending' check (request_status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_pending_shipping_change_per_order
  on public.order_shipping_change_requests(order_id) where request_status = 'pending';

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  zone_name text not null,
  country_code text not null,
  region_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones(id) on delete restrict,
  min_weight_grams integer not null check (min_weight_grams >= 0),
  max_weight_grams integer not null check (max_weight_grams > min_weight_grams),
  base_fee_myr numeric(12,2) not null check (base_fee_myr >= 0),
  additional_fee_myr numeric(12,2) not null default 0 check (additional_fee_myr >= 0),
  additional_unit_grams integer not null default 0 check (additional_unit_grams >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shipping_rates_zone_weight_idx on public.shipping_rates(zone_id,min_weight_grams,max_weight_grams) where is_active;

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  shipment_number text not null,
  carrier_name text,
  tracking_number text,
  tracking_url text,
  shipment_status text not null default 'preparing' check (shipment_status in ('preparing','shipped','in_transit','delivered','exception')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, shipment_number)
);
create table if not exists public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(shipment_id, order_item_id)
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_system_role boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_user_roles (
  admin_user_id uuid not null references public.admin_users(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key(admin_user_id, role_id)
);
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete restrict,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key(role_id, permission_id)
);
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_actor_idx on public.admin_audit_logs(actor_user_id,created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit_logs(target_type,target_id);

create table if not exists app_private.owner_principal (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  established_at timestamptz not null default now(),
  established_by uuid references auth.users(id) on delete restrict
);
create table if not exists app_private.owner_recovery_credentials (
  singleton boolean primary key default true check (singleton),
  secret_hash text,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);
create table if not exists app_private.owner_recovery_audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.roles(name,description,is_system_role) values
 ('Owner','Highest-level website owner role',true),
 ('Admin','Administrative role',true),
 ('Staff','Staff role',true)
on conflict(name) do nothing;

insert into public.permissions(code,description) values
 ('products.view','View products'),
 ('products.create','Create products'),
 ('products.edit','Edit products'),
 ('products.archive','Archive products'),
 ('products.restore','Restore archived products'),
 ('inventory.view','View inventory'),
 ('inventory.adjust','Adjust stock'),
 ('inventory.release','Release reserved stock through approved workflows'),
 ('orders.view','View orders'),
 ('orders.cancel.approve','Approve cancellation requests'),
 ('orders.cancel.execute','Execute approved cancellations'),
 ('orders.shipping_address.review','Review shipping address change requests'),
 ('orders.complete','Manually complete shipped orders'),
 ('payments.review','Review payment proofs'),
 ('shipments.manage','Manage shipments and tracking'),
 ('shipping_rates.manage','Manage shipping zones and rates'),
 ('customers.view','View customers'),
 ('customers.manage','Manage customer records'),
 ('content.manage','Manage storefront content'),
 ('settings.manage','Manage general site settings'),
 ('admins.manage','Manage admin users and role assignments'),
 ('roles.manage','Manage roles and role permissions'),
 ('audit_logs.view','View admin audit logs')
on conflict(code) do nothing;

create or replace function app_private.is_owner()
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists(select 1 from app_private.owner_principal op
 where op.singleton = true and op.user_id = (select auth.uid()))
$$;

create or replace function app_private.is_admin_user()
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists(select 1 from public.admin_users au
 where au.user_id = (select auth.uid()) and au.is_active)
$$;

create or replace function app_private.has_permission(p_code text)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select app_private.is_owner()
 or exists(
   select 1
   from public.admin_users au
   join public.admin_user_roles aur on aur.admin_user_id = au.id
   join public.role_permissions rp on rp.role_id = aur.role_id
   join public.permissions p on p.id = rp.permission_id
   where au.user_id = (select auth.uid())
     and au.is_active
     and p.code = p_code
 )
$$;

revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.is_owner() to authenticated;
grant execute on function app_private.is_admin_user() to authenticated;
grant execute on function app_private.has_permission(text) to authenticated;

grant select on public.brands,public.categories,public.products,public.product_variants,public.product_images,
 public.homepage_slides,public.homepage_banners,public.about_images,public.shipping_zones,public.shipping_rates
to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.customer_addresses,public.carts,public.cart_items to authenticated;
grant select on public.orders,public.order_items,public.payment_proofs,public.payment_status_history,
 public.order_status_history,public.order_cancellation_requests,public.order_shipping_change_requests,
 public.shipments,public.shipment_items to authenticated;
grant select on public.admin_users,public.roles,public.permissions,public.admin_user_roles,public.role_permissions,
 public.admin_audit_logs to authenticated;
grant select,insert,update,delete on public.brands,public.categories,public.products,public.product_variants,
 public.product_images,public.homepage_slides,public.homepage_banners,public.about_images,public.site_settings,
 public.shipping_zones,public.shipping_rates to authenticated;

alter table public.profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.homepage_slides enable row level security;
alter table public.homepage_banners enable row level security;
alter table public.about_images enable row level security;
alter table public.site_settings enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.payment_status_history enable row level security;
alter table public.order_status_history enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.order_submission_requests enable row level security;
alter table public.order_cancellation_requests enable row level security;
alter table public.order_shipping_change_requests enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security;
alter table public.admin_users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.admin_user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "addresses_own_all" on public.customer_addresses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "brands_public_read" on public.brands for select to anon,authenticated using (is_active or app_private.has_permission('products.view'));
create policy "categories_public_read" on public.categories for select to anon,authenticated using (is_active or app_private.has_permission('products.view'));
create policy "products_public_read" on public.products for select to anon,authenticated using (
 (is_published and not is_archived and (sold_out_display = 'show' or stock_quantity > reserved_quantity))
 or app_private.has_permission('products.view')
);
create policy "variants_public_read" on public.product_variants for select to anon,authenticated using (
 is_active and exists(select 1 from public.products p where p.id = product_id and p.is_published and not p.is_archived)
 or app_private.has_permission('products.view')
);
create policy "product_images_public_read" on public.product_images for select to anon,authenticated using (
 exists(select 1 from public.products p where p.id = product_id and p.is_published and not p.is_archived)
 or app_private.has_permission('products.view')
);
create policy "products_admin_manage" on public.products for all to authenticated using (app_private.has_permission('products.create') or app_private.has_permission('products.edit') or app_private.has_permission('products.archive') or app_private.has_permission('products.restore')) with check (app_private.has_permission('products.create') or app_private.has_permission('products.edit') or app_private.has_permission('products.archive') or app_private.has_permission('products.restore'));
create policy "variants_admin_manage" on public.product_variants for all to authenticated using (app_private.has_permission('products.create') or app_private.has_permission('products.edit')) with check (app_private.has_permission('products.create') or app_private.has_permission('products.edit'));
create policy "images_admin_manage" on public.product_images for all to authenticated using (app_private.has_permission('products.create') or app_private.has_permission('products.edit')) with check (app_private.has_permission('products.create') or app_private.has_permission('products.edit'));
create policy "brands_admin_manage" on public.brands for all to authenticated using (app_private.has_permission('products.create') or app_private.has_permission('products.edit')) with check (app_private.has_permission('products.create') or app_private.has_permission('products.edit'));
create policy "categories_admin_manage" on public.categories for all to authenticated using (app_private.has_permission('products.create') or app_private.has_permission('products.edit')) with check (app_private.has_permission('products.create') or app_private.has_permission('products.edit'));

create policy "homepage_slides_public_read" on public.homepage_slides for select to anon,authenticated using (is_active or app_private.has_permission('content.manage'));
create policy "homepage_banners_public_read" on public.homepage_banners for select to anon,authenticated using (is_active or app_private.has_permission('content.manage'));
create policy "about_images_public_read" on public.about_images for select to anon,authenticated using (is_active or app_private.has_permission('content.manage'));
create policy "content_admin_manage_slides" on public.homepage_slides for all to authenticated using (app_private.has_permission('content.manage')) with check (app_private.has_permission('content.manage'));
create policy "content_admin_manage_banners" on public.homepage_banners for all to authenticated using (app_private.has_permission('content.manage')) with check (app_private.has_permission('content.manage'));
create policy "content_admin_manage_about" on public.about_images for all to authenticated using (app_private.has_permission('content.manage')) with check (app_private.has_permission('content.manage'));
create policy "settings_admin_manage" on public.site_settings for all to authenticated using (app_private.has_permission('settings.manage')) with check (app_private.has_permission('settings.manage'));

create policy "carts_own_all" on public.carts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cart_items_own_all" on public.cart_items for all to authenticated using (
 exists(select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))
) with check (
 exists(select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))
);

create policy "orders_read_own_or_authorized" on public.orders for select to authenticated using (
 user_id = (select auth.uid()) or app_private.has_permission('orders.view')
);
create policy "order_items_read_own_or_authorized" on public.order_items for select to authenticated using (
 exists(select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or app_private.has_permission('orders.view')))
);
create policy "payment_proofs_read_own_or_authorized" on public.payment_proofs for select to authenticated using (
 user_id = (select auth.uid()) or app_private.has_permission('payments.review')
);
create policy "payment_history_read_own_or_authorized" on public.payment_status_history for select to authenticated using (
 exists(select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or app_private.has_permission('orders.view')))
);
create policy "order_history_read_own_or_authorized" on public.order_status_history for select to authenticated using (
 exists(select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or app_private.has_permission('orders.view')))
);
create policy "cancel_requests_read_own_or_authorized" on public.order_cancellation_requests for select to authenticated using (
 user_id = (select auth.uid()) or app_private.has_permission('orders.view')
);
create policy "shipping_change_read_own_or_authorized" on public.order_shipping_change_requests for select to authenticated using (
 user_id = (select auth.uid()) or app_private.has_permission('orders.view')
);
create policy "shipments_read_own_or_authorized" on public.shipments for select to authenticated using (
 exists(select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or app_private.has_permission('orders.view')))
);
create policy "shipment_items_read_own_or_authorized" on public.shipment_items for select to authenticated using (
 exists(select 1 from public.shipments s join public.orders o on o.id=s.order_id where s.id=shipment_id and (o.user_id=(select auth.uid()) or app_private.has_permission('orders.view')))
);

create policy "shipping_zones_public_active_read" on public.shipping_zones for select to anon,authenticated using (is_active);
create policy "shipping_rates_public_active_read" on public.shipping_rates for select to anon,authenticated using (
 is_active and exists(select 1 from public.shipping_zones z where z.id=zone_id and z.is_active)
);
create policy "shipping_zones_admin_manage" on public.shipping_zones for all to authenticated using (app_private.has_permission('shipping_rates.manage')) with check (app_private.has_permission('shipping_rates.manage'));
create policy "shipping_rates_admin_manage" on public.shipping_rates for all to authenticated using (app_private.has_permission('shipping_rates.manage')) with check (app_private.has_permission('shipping_rates.manage'));

create policy "admin_users_read_authorized" on public.admin_users for select to authenticated using (
 user_id=(select auth.uid()) or app_private.has_permission('admins.manage')
);
create policy "roles_read_authorized" on public.roles for select to authenticated using (app_private.is_admin_user());
create policy "permissions_read_authorized" on public.permissions for select to authenticated using (app_private.is_admin_user());
create policy "admin_user_roles_read_authorized" on public.admin_user_roles for select to authenticated using (app_private.is_admin_user());
create policy "role_permissions_read_authorized" on public.role_permissions for select to authenticated using (app_private.is_admin_user());
create policy "admin_audit_logs_read_authorized" on public.admin_audit_logs for select to authenticated using (app_private.has_permission('audit_logs.view'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
 insert into public.profiles(id,display_name)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'))
 on conflict(id) do nothing;
 return new;
end;
$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
 new.updated_at = now();
 return new;
end;
$$;
revoke all on function public.set_updated_at() from public,anon,authenticated;

do $$
declare t text;
begin
 foreach t in array array[
 'profiles','customer_addresses','brands','categories','products','product_variants',
 'homepage_slides','homepage_banners','site_settings','carts','cart_items','orders',
 'order_cancellation_requests','order_shipping_change_requests','shipping_zones','shipping_rates',
 'shipments','admin_users'
 ] loop
  execute format('drop trigger if exists set_updated_at on public.%I',t);
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('homepage-media','homepage-media',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set
 public=excluded.public,
 file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

create policy "public_read_product_images" on storage.objects for select to anon,authenticated using (bucket_id='product-images');
create policy "public_read_homepage_media" on storage.objects for select to anon,authenticated using (bucket_id='homepage-media');
create policy "admins_manage_product_images" on storage.objects for all to authenticated using (
 bucket_id='product-images' and (app_private.has_permission('products.create') or app_private.has_permission('products.edit'))
) with check (
 bucket_id='product-images' and (app_private.has_permission('products.create') or app_private.has_permission('products.edit'))
);
create policy "admins_manage_homepage_media" on storage.objects for all to authenticated using (
 bucket_id='homepage-media' and app_private.has_permission('content.manage')
) with check (
 bucket_id='homepage-media' and app_private.has_permission('content.manage')
);
create policy "customers_upload_own_payment_proofs" on storage.objects for insert to authenticated with check (
 bucket_id='payment-proofs' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "customers_read_own_payment_proofs" on storage.objects for select to authenticated using (
 bucket_id='payment-proofs' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or app_private.has_permission('payments.review')
 )
);

comment on table public.products is 'Catalogue products; archived products are never hard-deleted through the storefront.';
comment on table public.inventory_movements is 'Append-only inventory ledger; client DML is intentionally not granted.';
comment on table public.admin_audit_logs is 'Append-only admin audit trail; client DML is intentionally not granted.';
