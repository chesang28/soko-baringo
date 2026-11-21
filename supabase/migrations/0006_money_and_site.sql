-- Money tracking, revenue reporting, order tracking, farmer leads, public stats.

-- ─── Order lifecycle timestamps ─────────────────────────────────────────
alter table public.orders add column confirmed_at timestamptz;
alter table public.orders add column delivered_at timestamptz;

create or replace function public.orders_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('confirmed', 'delivered', 'paid') and new.confirmed_at is null then
    new.confirmed_at := now();
  end if;
  if new.status in ('delivered', 'paid') and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

create trigger orders_lifecycle
  before insert or update of status on public.orders
  for each row execute function public.orders_lifecycle();

-- ─── Pricing: default total = quantity × listed price, then commission ──
create or replace function public.orders_compute_commission()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_rate  numeric;
  v_price integer;
begin
  if new.agreed_total_kes is null then
    select price_per_unit_kes into v_price from public.listings where id = new.listing_id;
    new.agreed_total_kes := round(new.quantity * coalesce(v_price, 0));
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

-- Backfill: totals for existing orders, timestamps for already-committed ones.
update public.orders set agreed_total_kes = null where agreed_total_kes is null;
update public.orders set confirmed_at = coalesce(confirmed_at, updated_at)
  where status in ('confirmed', 'delivered', 'paid');
update public.orders set delivered_at = coalesce(delivered_at, updated_at)
  where status in ('delivered', 'paid');

create index orders_confirmed_at_idx on public.orders (confirmed_at) where confirmed_at is not null;

-- ─── Payments ledger ────────────────────────────────────────────────────
create type public.payment_direction as enum ('from_buyer', 'to_farmer');
create type public.payment_method    as enum ('mpesa', 'cash', 'bank', 'other');

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete restrict,
  direction  public.payment_direction not null,
  amount_kes integer not null check (amount_kes > 0),
  method     public.payment_method not null default 'mpesa',
  reference  text check (char_length(reference) <= 60),   -- e.g. M-Pesa code
  paid_at    timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_paid_at_idx on public.payments (paid_at);

alter table public.payments enable row level security;
create policy payments_admin_all on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Per-order balances. Buyer owes once confirmed; farmer is owed once delivered.
create view public.order_balances with (security_invoker = true) as
select
  b.*,
  case when b.status in ('confirmed', 'delivered', 'paid') then greatest(b.total_kes - b.received_kes, 0) else 0 end as buyer_owes_kes,
  case when b.status in ('delivered', 'paid') then greatest(b.farmer_share_kes - b.paid_out_kes, 0) else 0 end as farmer_owed_kes
from (
  select
    o.id as order_id, o.status, o.created_at, o.confirmed_at,
    o.buyer_name, o.buyer_phone, o.buyer_org,
    l.farmer_id, f.full_name as farmer_name, f.phone as farmer_phone,
    coalesce(o.agreed_total_kes, 0)                              as total_kes,
    coalesce(o.commission_kes, 0)                                as commission_kes,
    coalesce(o.agreed_total_kes, 0) - coalesce(o.commission_kes, 0) as farmer_share_kes,
    coalesce((select sum(p.amount_kes) from public.payments p where p.order_id = o.id and p.direction = 'from_buyer'), 0)::int as received_kes,
    coalesce((select sum(p.amount_kes) from public.payments p where p.order_id = o.id and p.direction = 'to_farmer'), 0)::int  as paid_out_kes
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.farmers  f on f.id = l.farmer_id
) b;

-- ─── Daily revenue (Kenya time) ─────────────────────────────────────────
-- Sales & commission by confirmation day; cash by payment day.
create or replace function public.daily_revenue(p_days integer default 62)
returns table (day date, sales_kes bigint, commission_kes bigint, orders bigint, cash_in_kes bigint, cash_out_kes bigint)
language sql stable set search_path = '' as $$
  with days as (
    select generate_series(
      (now() at time zone 'Africa/Nairobi')::date - (least(greatest(p_days, 1), 400) - 1),
      (now() at time zone 'Africa/Nairobi')::date,
      interval '1 day')::date as day
  ),
  sales as (
    select (confirmed_at at time zone 'Africa/Nairobi')::date as day,
           sum(agreed_total_kes) as sales, sum(commission_kes) as commission, count(*) as n
    from public.orders
    where status in ('confirmed', 'delivered', 'paid') and confirmed_at is not null
    group by 1
  ),
  cash as (
    select (paid_at at time zone 'Africa/Nairobi')::date as day,
           sum(amount_kes) filter (where direction = 'from_buyer') as cin,
           sum(amount_kes) filter (where direction = 'to_farmer')  as cout
    from public.payments
    group by 1
  )
  select d.day,
         coalesce(s.sales, 0)::bigint, coalesce(s.commission, 0)::bigint, coalesce(s.n, 0)::bigint,
         coalesce(c.cin, 0)::bigint, coalesce(c.cout, 0)::bigint
  from days d
  left join sales s on s.day = d.day
  left join cash  c on c.day = d.day
  order by d.day;
$$;
revoke execute on function public.daily_revenue(integer) from public, anon;
grant execute on function public.daily_revenue(integer) to authenticated;  -- RLS limits data to admins

-- ─── Public contact + stats ─────────────────────────────────────────────
alter table public.settings add column agent_phone public.ke_phone;

create or replace function public.site_stats()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'farmers',     (select count(*) from public.farmers),
    'wards',       (select count(distinct lower(ward)) from public.farmers),
    'listings',    (select count(*) from public.listings where status = 'available'),
    'deliveries',  (select count(*) from public.orders where status in ('delivered', 'paid')),
    'agent_phone', (select agent_phone from public.settings where id)
  );
$$;
revoke all on function public.site_stats() from public;
grant execute on function public.site_stats() to anon, authenticated;

-- ─── Buyer order tracking (by unguessable order id, no personal data) ───
create or replace function public.track_order(p_id uuid)
returns table (status public.order_status, product text, quantity numeric, unit public.unit,
               location text, total_kes integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.status, p.name, o.quantity, l.unit, l.location, o.agreed_total_kes, o.created_at
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.products p on p.id = l.product_id
  where o.id = p_id;
$$;
revoke all on function public.track_order(uuid) from public;
grant execute on function public.track_order(uuid) to anon, authenticated;

-- ─── Farmer leads ("Sell with us") ──────────────────────────────────────
create table public.farmer_leads (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(full_name) between 2 and 120),
  phone      public.ke_phone not null,
  ward       text not null check (char_length(ward) between 2 and 80),
  produce    text check (char_length(produce) <= 200),
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
create index farmer_leads_created_idx on public.farmer_leads (handled, created_at desc);
alter table public.farmer_leads enable row level security;
create policy farmer_leads_admin_all on public.farmer_leads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.request_farmer_visit(p_name text, p_phone text, p_ward text, p_produce text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.farmer_leads where phone = p_phone and created_at > now() - interval '1 day') >= 2 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.farmer_leads (full_name, phone, ward, produce)
  values (btrim(p_name), p_phone, btrim(p_ward), nullif(btrim(p_produce), ''));
end;
$$;
revoke all on function public.request_farmer_visit(text, text, text, text) from public;
grant execute on function public.request_farmer_visit(text, text, text, text) to anon, authenticated;
