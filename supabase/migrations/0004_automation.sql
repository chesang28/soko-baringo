-- Level 1 automation: commission, stock sync, listing expiry.

-- ─── Settings (single row) ──────────────────────────────────────────────
create table public.settings (
  id              boolean primary key default true check (id),
  commission_rate numeric(5, 4) not null default 0.05 check (commission_rate >= 0 and commission_rate < 1),
  updated_at      timestamptz not null default now()
);
insert into public.settings default values on conflict do nothing;
alter table public.settings enable row level security;
create policy settings_admin_all on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ─── Shelf life per product (drives auto-expiry) ────────────────────────
alter table public.products
  add column shelf_life_days smallint not null default 14 check (shelf_life_days between 1 and 365);

update public.products set shelf_life_days = case name
  when 'Mangoes'     then 10
  when 'Pawpaw'      then 7
  when 'Bananas'     then 7
  when 'Avocados'    then 10
  when 'Oranges'     then 14
  when 'Aloe vera'   then 14
  when 'Honey'       then 90
  when 'Groundnuts'  then 60
  when 'Sorghum'     then 90
  when 'Green grams' then 90
  else shelf_life_days end;

-- ─── Listings can reach 0 once sold, but never while "available" ───────
alter table public.listings drop constraint listings_quantity_check;
alter table public.listings add constraint listings_quantity_check check (quantity >= 0);
alter table public.listings add constraint listings_available_has_stock check (status <> 'available' or quantity > 0);

-- ─── Auto-commission ────────────────────────────────────────────────────
-- Computes commission from agreed total when commission is blank, or when the
-- total changes and commission was left as-is. An explicit edit is respected.
create or replace function public.orders_compute_commission()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_rate numeric;
begin
  if new.agreed_total_kes is null then
    return new;
  end if;

  if new.commission_kes is null
     or (tg_op = 'UPDATE'
         and new.agreed_total_kes is distinct from old.agreed_total_kes
         and new.commission_kes is not distinct from old.commission_kes) then
    select commission_rate into v_rate from public.settings where id;
    new.commission_kes := round(new.agreed_total_kes * coalesce(v_rate, 0.05));
  end if;
  return new;
end;
$$;

create trigger orders_commission
  before insert or update of agreed_total_kes, commission_kes on public.orders
  for each row execute function public.orders_compute_commission();

-- ─── Stock sync ─────────────────────────────────────────────────────────
-- Orders in confirmed/delivered/paid hold stock. Moving into those states takes
-- stock from the listing; moving out (cancel, delete) returns it. Listing flips
-- to sold_out at 0 and back to available when stock returns.
create or replace function public.orders_sync_stock()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_held_old numeric := 0;
  v_held_new numeric := 0;
  v_delta    numeric;
  v_listing  uuid;
  v_qty      numeric;
begin
  if tg_op = 'UPDATE' and new.listing_id <> old.listing_id then
    raise exception 'LISTING_CHANGE_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.status in ('confirmed', 'delivered', 'paid') then
    v_held_old := old.quantity;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status in ('confirmed', 'delivered', 'paid') then
    v_held_new := new.quantity;
  end if;

  v_delta := v_held_new - v_held_old;          -- > 0 takes stock, < 0 returns it
  if v_delta = 0 then
    return null;
  end if;

  v_listing := case when tg_op = 'DELETE' then old.listing_id else new.listing_id end;

  select quantity into v_qty from public.listings where id = v_listing for update;
  if v_delta > v_qty then
    raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001';
  end if;
  v_qty := v_qty - v_delta;

  update public.listings
  set quantity = v_qty,
      status = case
        when v_qty = 0 and status in ('available', 'reserved') then 'sold_out'::public.listing_status
        when v_qty > 0 and status = 'sold_out'                 then 'available'::public.listing_status
        else status
      end
  where id = v_listing;

  return null;
end;
$$;

create trigger orders_stock
  after insert or update of status, quantity, listing_id or delete on public.orders
  for each row execute function public.orders_sync_stock();

-- ─── Auto-expiry of stale listings ──────────────────────────────────────
-- A listing not touched within its product's shelf life is hidden.
-- Saving it again in the admin (status → available) renews it.
create or replace function public.expire_stale_listings()
returns integer language sql set search_path = '' as $$
  with expired as (
    update public.listings l
    set status = 'expired'
    from public.products p
    where p.id = l.product_id
      and l.status = 'available'
      and l.updated_at < now() - make_interval(days => p.shelf_life_days)
    returning 1
  )
  select count(*)::int from expired;
$$;
revoke execute on function public.expire_stale_listings() from public, anon, authenticated;
