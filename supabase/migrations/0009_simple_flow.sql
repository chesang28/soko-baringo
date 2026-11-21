-- Simple step-by-step order flow with hired transport (driver) accounting.

alter table public.orders
  add column delivery_method    text not null default 'pickup' check (delivery_method in ('pickup', 'hired')),
  add column driver_name        text check (char_length(driver_name) <= 120),
  add column driver_phone       public.ke_phone,
  add column transport_cost_kes integer not null default 0 check (transport_cost_kes >= 0);

-- Balances: add driver side, profit and a "settled" flag.
drop view public.agent_earnings;
drop view public.order_balances;

create view public.order_balances with (security_invoker = true) as
select
  b.*,
  case when b.status in ('confirmed', 'delivered', 'paid') then greatest(b.total_kes + b.delivery_fee_kes - b.received_kes, 0) else 0 end as buyer_owes_kes,
  case when b.status in ('delivered', 'paid') then greatest(b.farmer_share_kes - b.paid_out_kes, 0) else 0 end as farmer_owed_kes,
  case when b.status in ('delivered', 'paid') then greatest(b.transport_cost_kes - b.driver_paid_kes, 0) else 0 end as driver_owed_kes,
  b.commission_kes + b.delivery_fee_kes - b.transport_cost_kes as profit_kes
from (
  select
    o.id as order_id, o.status, o.created_at, o.confirmed_at, o.delivered_at, o.run_id,
    o.buyer_name, o.buyer_phone, o.buyer_org, o.quantity, o.note,
    l.farmer_id, f.full_name as farmer_name, f.phone as farmer_phone, f.created_by as agent_id,
    p.name as product, l.unit, l.price_per_unit_kes, l.location,
    coalesce(o.agreed_total_kes, 0)                                  as total_kes,
    coalesce(o.commission_kes, 0)                                    as commission_kes,
    coalesce(o.agreed_total_kes, 0) - coalesce(o.commission_kes, 0)  as farmer_share_kes,
    o.delivery_fee_kes, o.delivery_method, o.driver_name, o.driver_phone, o.transport_cost_kes,
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

-- Auto-complete: an order becomes "paid" once delivered and the buyer has paid in full.
create or replace function public.orders_auto_paid(p_order_id uuid)
returns void language sql set search_path = '' as $$
  update public.orders o set status = 'paid'
  where o.id = p_order_id and o.status = 'delivered'
    and coalesce((select sum(amount_kes) from public.payments where order_id = o.id and direction = 'from_buyer'), 0)
        >= coalesce(o.agreed_total_kes, 0) + o.delivery_fee_kes;
$$;

create or replace function public.payments_after_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.direction = 'from_buyer' then perform public.orders_auto_paid(new.order_id); end if;
  return null;
end;
$$;
create trigger payments_auto_paid after insert on public.payments
  for each row execute function public.payments_after_insert();

create or replace function public.orders_after_delivered()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    perform public.orders_auto_paid(new.id);
  end if;
  return null;
end;
$$;
create trigger orders_auto_paid after update of status on public.orders
  for each row execute function public.orders_after_delivered();

-- Revenue: transport cost now includes hired transport per order (by delivery day).
create or replace function public.daily_revenue(p_days integer default 62)
returns table (day date, sales_kes bigint, commission_kes bigint, orders bigint, cash_in_kes bigint,
               cash_out_kes bigint, delivery_fees_kes bigint, transport_cost_kes bigint)
language sql stable set search_path = '' as $$
  with days as (
    select generate_series(
      (now() at time zone 'Africa/Nairobi')::date - (least(greatest(p_days, 1), 400) - 1),
      (now() at time zone 'Africa/Nairobi')::date,
      interval '1 day')::date as day
  ),
  sales as (
    select (confirmed_at at time zone 'Africa/Nairobi')::date as day,
           sum(agreed_total_kes) as sales, sum(commission_kes) as commission,
           sum(delivery_fee_kes) as fees, count(*) as n
    from public.orders
    where status in ('confirmed', 'delivered', 'paid') and confirmed_at is not null
    group by 1
  ),
  cash as (
    select (paid_at at time zone 'Africa/Nairobi')::date as day,
           sum(amount_kes) filter (where direction = 'from_buyer') as cin,
           sum(amount_kes) filter (where direction in ('to_farmer', 'to_driver')) as cout
    from public.payments group by 1
  ),
  transport as (
    select day, sum(cost) as cost from (
      select run_date as day, cost_kes as cost from public.delivery_runs
      union all
      select (delivered_at at time zone 'Africa/Nairobi')::date, transport_cost_kes
      from public.orders where status in ('delivered', 'paid') and delivered_at is not null and transport_cost_kes > 0
    ) t group by 1
  )
  select d.day,
         coalesce(s.sales, 0)::bigint, coalesce(s.commission, 0)::bigint, coalesce(s.n, 0)::bigint,
         coalesce(c.cin, 0)::bigint, coalesce(c.cout, 0)::bigint,
         coalesce(s.fees, 0)::bigint, coalesce(t.cost, 0)::bigint
  from days d
  left join sales s on s.day = d.day
  left join cash  c on c.day = d.day
  left join transport t on t.day = d.day
  order by d.day;
$$;
revoke execute on function public.daily_revenue(integer) from public, anon;
grant execute on function public.daily_revenue(integer) to authenticated;

-- Bring existing delivered orders that are fully paid up to date.
select public.orders_auto_paid(id) from public.orders where status = 'delivered';
