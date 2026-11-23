-- Minimum fee, deposits, rejections, consent, crop focus, farmer passbook.

-- ═══ Minimum commission ═════════════════════════════════════════════════
alter table public.settings add column min_commission_kes integer not null default 0 check (min_commission_kes >= 0);

create or replace function public.orders_compute_commission()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_rate  numeric;
  v_min   integer;
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
    select commission_rate, min_commission_kes into v_rate, v_min from public.settings where id;
    -- max(rate × total, minimum fee), but never more than the sale itself
    new.commission_kes := least(greatest(round(new.agreed_total_kes * coalesce(v_rate, 0.05)), coalesce(v_min, 0)), new.agreed_total_kes);
  end if;
  return new;
end;
$$;

-- ═══ Deposits & rejections & consent on orders ══════════════════════════
alter table public.orders
  add column deposit_required_kes integer not null default 0 check (deposit_required_kes >= 0),
  add column rejected_qty         numeric(12, 2) not null default 0 check (rejected_qty >= 0),
  add column rejection_value_kes  integer not null default 0 check (rejection_value_kes >= 0),
  add column rejection_cost_by    text check (rejection_cost_by in ('farmer', 'transporter', 'soko')),
  add column rejection_note       text check (char_length(rejection_note) <= 500),
  add column rejection_photo_path text check (rejection_photo_path ~ '^rejections/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  add column farmer_extra_kes     integer not null default 0 check (farmer_extra_kes >= 0),
  add column driver_deduction_kes integer not null default 0 check (driver_deduction_kes >= 0);

alter table public.farmers add column consent_at timestamptz;
update public.farmers set consent_at = created_at where consent_at is null;  -- registered in person before this field existed

-- ═══ Farmer passbook (private link per farmer) ══════════════════════════
alter table public.farmers
  add column passbook_token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

-- ═══ Balances view: deposits, rejections, passbook ══════════════════════
drop view public.agent_earnings;
drop view public.order_balances;

create view public.order_balances with (security_invoker = true) as
select
  b.*,
  case when b.status in ('confirmed', 'delivered', 'paid') then greatest(b.total_kes + b.delivery_fee_kes - b.received_kes, 0) else 0 end as buyer_owes_kes,
  case when b.status in ('delivered', 'paid') then greatest(b.farmer_share_kes - b.paid_out_kes, 0) else 0 end as farmer_owed_kes,
  case when b.status in ('delivered', 'paid') then greatest(b.driver_cost_kes - b.driver_paid_kes, 0) else 0 end as driver_owed_kes,
  b.commission_kes + b.delivery_fee_kes - b.driver_cost_kes - b.farmer_extra_kes as profit_kes
from (
  select
    o.id as order_id, o.status, o.created_at, o.confirmed_at, o.delivered_at, o.run_id,
    o.buyer_name, o.buyer_phone, o.buyer_org, o.quantity, o.note,
    l.farmer_id, f.full_name as farmer_name, f.phone as farmer_phone, f.created_by as agent_id, f.passbook_token,
    p.name as product, l.unit, l.price_per_unit_kes, l.location,
    coalesce(o.agreed_total_kes, 0)                                                       as total_kes,
    coalesce(o.commission_kes, 0)                                                         as commission_kes,
    coalesce(o.agreed_total_kes, 0) - coalesce(o.commission_kes, 0) + o.farmer_extra_kes  as farmer_share_kes,
    o.delivery_fee_kes, o.delivery_method, o.driver_name, o.driver_phone, o.transport_cost_kes,
    greatest(o.transport_cost_kes - o.driver_deduction_kes, 0)                            as driver_cost_kes,
    o.deposit_required_kes, o.rejected_qty, o.rejection_value_kes, o.rejection_cost_by, o.rejection_note,
    o.rejection_photo_path, o.farmer_extra_kes, o.driver_deduction_kes,
    coalesce((select sum(x.amount_kes) from public.payments x where x.order_id = o.id and x.direction = 'from_buyer'), 0)::int as received_kes,
    coalesce((select sum(x.amount_kes) from public.payments x where x.order_id = o.id and x.direction = 'to_farmer'), 0)::int  as paid_out_kes,
    coalesce((select sum(x.amount_kes) from public.payments x where x.order_id = o.id and x.direction = 'to_driver'), 0)::int  as driver_paid_kes
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.farmers  f on f.id = l.farmer_id
  join public.products p on p.id = l.product_id
) b;

create view public.agent_earnings with (security_invoker = true) as
select
  a.user_id as agent_id, a.full_name, a.ward, a.role, a.commission_share, a.active,
  (select count(*) from public.farmers f where f.created_by = a.user_id)::int as farmers,
  coalesce(s.sales_kes, 0)::int       as sales_kes,
  coalesce(s.commission_kes, 0)::int  as commission_kes,
  round(coalesce(s.commission_kes, 0) * a.commission_share)::int as earned_kes,
  coalesce((select sum(p.amount_kes) from public.agent_payouts p where p.agent_id = a.user_id), 0)::int as paid_kes
from public.admins a
left join (
  select b.agent_id, sum(b.total_kes) as sales_kes, sum(b.commission_kes) as commission_kes
  from public.order_balances b
  where b.status in ('delivered', 'paid')
  group by b.agent_id
) s on s.agent_id = a.user_id;

-- Public passbook: the farmer's own sales and payments. No buyer details.
create or replace function public.farmer_passbook(p_token text)
returns json language sql stable security definer set search_path = '' as $$
  with f as (select id, full_name, ward, created_at from public.farmers where passbook_token = p_token and length(p_token) = 64),
  sales as (
    select o.id, coalesce(o.delivered_at, o.confirmed_at, o.created_at) as at, p.name as product, o.quantity, l.unit, o.status,
           coalesce(o.agreed_total_kes, 0) as sale_kes,
           coalesce(o.agreed_total_kes, 0) - coalesce(o.commission_kes, 0) + o.farmer_extra_kes as share_kes
    from public.orders o
    join public.listings l on l.id = o.listing_id
    join public.products p on p.id = l.product_id
    where l.farmer_id = (select id from f) and o.status in ('confirmed', 'delivered', 'paid')
  ),
  pays as (
    select x.paid_at, x.amount_kes, x.method, x.reference, x.order_id
    from public.payments x join sales s on s.id = x.order_id
    where x.direction = 'to_farmer'
  )
  select case when not exists (select 1 from f) then null else json_build_object(
    'name',       (select split_part(full_name, ' ', 1) from f),
    'ward',       (select ward from f),
    'since',      (select created_at from f),
    'earned_kes', (select coalesce(sum(share_kes), 0) from sales where status in ('delivered', 'paid')),
    'paid_kes',   (select coalesce(sum(amount_kes), 0) from pays),
    'pending_kes',(select coalesce(sum(share_kes), 0) from sales where status = 'confirmed'),
    'sales',      (select coalesce(json_agg(json_build_object('ref', upper(left(id::text, 6)), 'at', at, 'product', product, 'quantity', quantity,
                     'unit', unit, 'status', status, 'sale_kes', sale_kes, 'share_kes', share_kes) order by at desc), '[]'::json) from sales),
    'payments',   (select coalesce(json_agg(json_build_object('at', paid_at, 'amount_kes', amount_kes, 'method', method, 'reference', reference,
                     'ref', upper(left(order_id::text, 6))) order by paid_at desc), '[]'::json) from pays)
  ) end;
$$;
revoke all on function public.farmer_passbook(text) from public;
grant execute on function public.farmer_passbook(text) to anon, authenticated;

-- ═══ Crop focus: only active crops appear publicly ═════════════════════
create or replace function public.open_needs()
returns table (id uuid, product text, product_id smallint, quantity numeric, unit public.unit, max_price_kes integer,
               needed_by date, location text, buyer_type text, responses bigint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, p.name, n.product_id, n.quantity, n.unit, n.max_price_kes, n.needed_by, n.location,
         case when n.buyer_org is not null then 'Business' else 'Individual' end,
         (select count(*) from public.need_responses r where r.need_id = n.id),
         n.created_at
  from public.buyer_needs n join public.products p on p.id = n.product_id
  where n.status = 'open' and p.active and n.needed_by >= (now() at time zone 'Africa/Nairobi')::date
  order by n.needed_by
  limit 100;
$$;

-- Public request functions refuse hidden crops.
create or replace function public.subscribe_stock_alert(p_product_id smallint, p_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.products where id = p_product_id and active) then
    raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if (select count(*) from public.stock_alerts where phone = p_phone and created_at > now() - interval '1 day') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.stock_alerts (product_id, name, phone)
  values (p_product_id, btrim(p_name), p_phone)
  on conflict (product_id, phone) where notified_at is null do nothing;
end;
$$;

create or replace function public.post_buyer_need(
  p_product_id smallint, p_quantity numeric, p_unit public.unit, p_max_price integer, p_needed_by date,
  p_location text, p_name text, p_phone text, p_org text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.products where id = p_product_id and active) then
    raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if (select count(*) from public.buyer_needs where buyer_phone = p_phone and created_at > now() - interval '1 day') >= 3 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  if p_needed_by < (now() at time zone 'Africa/Nairobi')::date or p_needed_by > (now() at time zone 'Africa/Nairobi')::date + 365 then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  insert into public.buyer_needs (product_id, quantity, unit, max_price_kes, needed_by, location, buyer_name, buyer_phone, buyer_org, note)
  values (p_product_id, p_quantity, p_unit, p_max_price, p_needed_by, btrim(p_location), btrim(p_name), p_phone,
          nullif(btrim(p_org), ''), nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Buy requests only for listings of active crops.
create or replace function public.request_order(
  p_listing_id uuid, p_buyer_name text, p_buyer_phone text, p_quantity numeric,
  p_buyer_org text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_available numeric;
  v_recent    int;
  v_id        uuid;
begin
  select l.quantity into v_available
  from public.listings l join public.products p on p.id = l.product_id
  where l.id = p_listing_id and l.status = 'available' and p.active
  for share of l;

  if v_available is null then raise exception 'LISTING_UNAVAILABLE' using errcode = 'P0001'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > v_available then raise exception 'INVALID_QUANTITY' using errcode = 'P0001'; end if;

  select count(*) into v_recent from public.orders
  where buyer_phone = p_buyer_phone and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'RATE_LIMITED' using errcode = 'P0001'; end if;

  insert into public.orders (listing_id, buyer_name, buyer_phone, buyer_org, quantity, note)
  values (p_listing_id, btrim(p_buyer_name), p_buyer_phone, nullif(btrim(p_buyer_org), ''), p_quantity, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Price board: active crops only.
create or replace function public.price_board()
returns table (product text, unit public.unit, listings bigint, min_listed integer, avg_listed integer, max_listed integer,
               avg_sold_30d integer, avg_sold_prev_30d integer, sold_qty_30d numeric)
language sql stable security definer set search_path = '' as $$
  with listed as (
    select l.product_id, l.unit, count(*) n, min(l.price_per_unit_kes) mn, round(avg(l.price_per_unit_kes)) av, max(l.price_per_unit_kes) mx
    from public.listings l where l.status = 'available' group by 1, 2
  ),
  sold as (
    select l.product_id, l.unit,
      round(sum(o.agreed_total_kes) filter (where o.confirmed_at > now() - interval '30 days')
          / nullif(sum(o.quantity) filter (where o.confirmed_at > now() - interval '30 days'), 0)) cur,
      round(sum(o.agreed_total_kes) filter (where o.confirmed_at <= now() - interval '30 days')
          / nullif(sum(o.quantity) filter (where o.confirmed_at <= now() - interval '30 days'), 0)) prev,
      coalesce(sum(o.quantity) filter (where o.confirmed_at > now() - interval '30 days'), 0) q
    from public.orders o join public.listings l on l.id = o.listing_id
    where o.status in ('confirmed', 'delivered', 'paid') and o.confirmed_at > now() - interval '60 days'
    group by 1, 2
  )
  select p.name, coalesce(li.unit, so.unit), coalesce(li.n, 0), li.mn::int, li.av::int, li.mx::int,
         so.cur::int, so.prev::int, coalesce(so.q, 0)
  from public.products p
  join (select product_id, unit from listed union select product_id, unit from sold) k on k.product_id = p.id
  left join listed li on li.product_id = k.product_id and li.unit = k.unit
  left join sold   so on so.product_id = k.product_id and so.unit = k.unit
  where p.active
  order by p.name;
$$;
