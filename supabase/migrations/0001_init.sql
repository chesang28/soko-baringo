-- Soko Baringo — initial schema
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push`).

create extension if not exists pgcrypto;

-- ─── Enums ──────────────────────────────────────────────────────────────
create type public.unit           as enum ('kg', 'crate', 'litre', 'piece', 'bag', 'tonne');
create type public.listing_status as enum ('available', 'reserved', 'sold_out', 'withdrawn');
create type public.order_status   as enum ('new', 'contacted', 'confirmed', 'delivered', 'paid', 'cancelled');

-- Kenyan mobile numbers stored in M-Pesa format: 2547XXXXXXXX / 2541XXXXXXXX
create domain public.ke_phone as text check (value ~ '^254[17][0-9]{8}$');

-- ─── Admins (you + future field agents) ─────────────────────────────────
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ─── Shared updated_at trigger ──────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Products catalogue ─────────────────────────────────────────────────
create table public.products (
  id           smallint generated always as identity primary key,
  name         text not null unique check (char_length(name) between 2 and 60),
  default_unit public.unit not null,
  active       boolean not null default true
);

-- ─── Farmers (PRIVATE — never exposed to the public) ────────────────────
create table public.farmers (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(full_name) between 2 and 120),
  phone      public.ke_phone not null unique,
  ward       text not null check (char_length(ward) between 2 and 80),
  village    text check (char_length(village) <= 80),
  group_name text check (char_length(group_name) <= 120),  -- co-op / SHG
  notes      text check (char_length(notes) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger farmers_touch before update on public.farmers
  for each row execute function public.touch_updated_at();

-- ─── Listings (public when available) ───────────────────────────────────
create table public.listings (
  id                 uuid primary key default gen_random_uuid(),
  farmer_id          uuid not null references public.farmers (id) on delete restrict,
  product_id         smallint not null references public.products (id),
  quantity           numeric(12, 2) not null check (quantity > 0),
  unit               public.unit not null,
  price_per_unit_kes integer not null check (price_per_unit_kes > 0),
  location           text not null check (char_length(location) between 2 and 120), -- pickup area, public
  description        text check (char_length(description) <= 1000),
  available_from     date not null default current_date,
  status             public.listing_status not null default 'available',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index listings_status_product_idx on public.listings (status, product_id, created_at desc);
create index listings_farmer_idx on public.listings (farmer_id);
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();

-- ─── Orders / buy requests ──────────────────────────────────────────────
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.listings (id) on delete restrict,
  buyer_name       text not null check (char_length(buyer_name) between 2 and 120),
  buyer_phone      public.ke_phone not null,
  buyer_org        text check (char_length(buyer_org) <= 120),
  quantity         numeric(12, 2) not null check (quantity > 0),
  note             text check (char_length(note) <= 500),
  status           public.order_status not null default 'new',
  agreed_total_kes integer check (agreed_total_kes >= 0),  -- filled by admin after negotiation
  commission_kes   integer check (commission_kes >= 0),    -- your earnings on this deal
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_listing_idx on public.orders (listing_id);
create index orders_buyer_phone_created_idx on public.orders (buyer_phone, created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────
alter table public.admins   enable row level security;
alter table public.products enable row level security;
alter table public.farmers  enable row level security;
alter table public.listings enable row level security;
alter table public.orders   enable row level security;

-- admins: only admins can see the admin list; managed via SQL editor.
create policy admins_read on public.admins for select to authenticated using (public.is_admin());

-- products: everyone reads active products; admins manage.
create policy products_public_read on public.products for select to anon, authenticated
  using (active or public.is_admin());
create policy products_admin_write on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- farmers: admins only. Phone numbers never leave the admin area.
create policy farmers_admin_all on public.farmers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- listings: public sees available stock; admins see & manage everything.
create policy listings_public_read on public.listings for select to anon, authenticated
  using (status = 'available' or public.is_admin());
create policy listings_admin_write on public.listings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- orders: admins only. Buyers create orders exclusively via request_order().
create policy orders_admin_all on public.orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Public RPC: buyer places a request ─────────────────────────────────
-- SECURITY DEFINER so anon never gets direct INSERT on orders; this function
-- is the only door, and it validates stock + applies a per-phone rate limit.
create or replace function public.request_order(
  p_listing_id  uuid,
  p_buyer_name  text,
  p_buyer_phone text,
  p_quantity    numeric,
  p_buyer_org   text default null,
  p_note        text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_available numeric;
  v_recent    int;
  v_id        uuid;
begin
  select quantity into v_available
  from public.listings
  where id = p_listing_id and status = 'available'
  for share;

  if v_available is null then
    raise exception 'LISTING_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity > v_available then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.orders
  where buyer_phone = p_buyer_phone and created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.orders (listing_id, buyer_name, buyer_phone, buyer_org, quantity, note)
  values (p_listing_id, btrim(p_buyer_name), p_buyer_phone,
          nullif(btrim(p_buyer_org), ''), p_quantity, nullif(btrim(p_note), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_order(uuid, text, text, numeric, text, text) from public;
grant execute on function public.request_order(uuid, text, text, numeric, text, text) to anon, authenticated;

-- ─── Seed: Baringo produce ──────────────────────────────────────────────
insert into public.products (name, default_unit) values
  ('Mangoes',     'crate'),
  ('Honey',       'kg'),
  ('Pawpaw',      'piece'),
  ('Oranges',     'crate'),
  ('Bananas',     'piece'),
  ('Groundnuts',  'kg'),
  ('Sorghum',     'bag'),
  ('Green grams', 'kg'),
  ('Avocados',    'piece'),
  ('Aloe vera',   'kg');
