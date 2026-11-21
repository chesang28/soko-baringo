-- Growth features: agents, photos & grades, buyer needs, delivery runs,
-- reviews, price board, daily digest.

-- ═══ Agents (team) ═══════════════════════════════════════════════════════
alter table public.admins
  add column full_name        text check (char_length(full_name) <= 120),
  add column ward             text check (char_length(ward) <= 80),
  add column role             text not null default 'agent' check (role in ('owner', 'agent')),
  add column commission_share numeric(4, 3) not null default 0.4 check (commission_share between 0 and 1),
  add column active           boolean not null default true;

-- Existing admin(s) become owner(s) and keep the full commission.
update public.admins set role = 'owner', commission_share = 0;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and active);
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and active and role = 'owner');
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

create policy admins_owner_update on public.admins for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Only owners change settings.
drop policy settings_admin_all on public.settings;
create policy settings_admin_read on public.settings for select to authenticated using (public.is_admin());
create policy settings_owner_write on public.settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Owner adds an agent by the email of a user created in Supabase Auth.
create or replace function public.add_agent(p_email text, p_name text, p_ward text, p_share numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_owner() then raise exception 'NOT_OWNER' using errcode = 'P0001'; end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then raise exception 'USER_NOT_FOUND' using errcode = 'P0001'; end if;
  insert into public.admins (user_id, full_name, ward, role, commission_share, active)
  values (v_user, btrim(p_name), nullif(btrim(p_ward), ''), 'agent', p_share, true)
  on conflict (user_id) do update
    set full_name = excluded.full_name, ward = excluded.ward,
        commission_share = excluded.commission_share, active = true;
end;
$$;
revoke all on function public.add_agent(text, text, text, numeric) from public, anon;
grant execute on function public.add_agent(text, text, text, numeric) to authenticated;

-- The agent who registered a farmer earns a share on that farmer's sales.
create index farmers_created_by_idx on public.farmers (created_by);

create table public.agent_payouts (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references public.admins (user_id) on delete restrict,
  amount_kes integer not null check (amount_kes > 0),
  method     public.payment_method not null default 'mpesa',
  reference  text check (char_length(reference) <= 60),
  paid_at    timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index agent_payouts_agent_idx on public.agent_payouts (agent_id);
alter table public.agent_payouts enable row level security;
create policy agent_payouts_read on public.agent_payouts for select to authenticated using (public.is_admin());
create policy agent_payouts_owner_write on public.agent_payouts for insert to authenticated with check (public.is_owner());

-- ═══ Listing photos & grades ═════════════════════════════════════════════
create type public.listing_grade as enum ('A', 'B', 'C');
alter table public.listings
  add column photo_path text check (photo_path ~ '^listings/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  add column grade      public.listing_grade;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$create policy listing_photos_admin_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'listing-photos' and public.is_admin())$p$;
    execute $p$create policy listing_photos_admin_update on storage.objects for update to authenticated
      using (bucket_id = 'listing-photos' and public.is_admin())$p$;
    execute $p$create policy listing_photos_admin_delete on storage.objects for delete to authenticated
      using (bucket_id = 'listing-photos' and public.is_admin())$p$;
  end if;
end;
$$;

-- ═══ Delivery runs ("Soko Days") ═════════════════════════════════════════
create table public.delivery_runs (
  id           uuid primary key default gen_random_uuid(),
  run_date     date not null,
  route        text not null check (char_length(route) between 2 and 120),
  vehicle      text check (char_length(vehicle) <= 60),
  driver_name  text check (char_length(driver_name) <= 120),
  driver_phone public.ke_phone,
  cost_kes     integer not null default 0 check (cost_kes >= 0),
  status       text not null default 'planned' check (status in ('planned', 'on_route', 'done')),
  notes        text check (char_length(notes) <= 1000),
  created_at   timestamptz not null default now()
);
create index delivery_runs_date_idx on public.delivery_runs (run_date desc);
alter table public.delivery_runs enable row level security;
create policy delivery_runs_admin_all on public.delivery_runs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.orders
  add column run_id           uuid references public.delivery_runs (id) on delete set null,
  add column delivery_fee_kes integer not null default 0 check (delivery_fee_kes >= 0);
create index orders_run_idx on public.orders (run_id);

-- Balances now include the delivery fee the buyer owes.
drop view public.order_balances;
create view public.order_balances with (security_invoker = true) as
select
  b.*,
  case when b.status in ('confirmed', 'delivered', 'paid') then greatest(b.total_kes + b.delivery_fee_kes - b.received_kes, 0) else 0 end as buyer_owes_kes,
  case when b.status in ('delivered', 'paid') then greatest(b.farmer_share_kes - b.paid_out_kes, 0) else 0 end as farmer_owed_kes
from (
  select
    o.id as order_id, o.status, o.created_at, o.confirmed_at, o.delivered_at, o.run_id,
    o.buyer_name, o.buyer_phone, o.buyer_org, o.quantity,
    l.farmer_id, f.full_name as farmer_name, f.phone as farmer_phone, f.created_by as agent_id,
    p.name as product, l.unit,
    coalesce(o.agreed_total_kes, 0)                                  as total_kes,
    coalesce(o.commission_kes, 0)                                    as commission_kes,
    coalesce(o.agreed_total_kes, 0) - coalesce(o.commission_kes, 0)  as farmer_share_kes,
    o.delivery_fee_kes,
    coalesce((select sum(x.amount_kes) from public.payments x where x.order_id = o.id and x.direction = 'from_buyer'), 0)::int as received_kes,
    coalesce((select sum(x.amount_kes) from public.payments x where x.order_id = o.id and x.direction = 'to_farmer'), 0)::int  as paid_out_kes
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.farmers  f on f.id = l.farmer_id
  join public.products p on p.id = l.product_id
) b;

-- Agent earnings: share of commission on delivered/paid sales of farmers they registered.
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

-- Revenue now also reports delivery fees and transport costs.
drop function public.daily_revenue(integer);
create function public.daily_revenue(p_days integer default 62)
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
           sum(amount_kes) filter (where direction = 'to_farmer')  as cout
    from public.payments group by 1
  ),
  runs as (
    select run_date as day, sum(cost_kes) as cost from public.delivery_runs group by 1
  )
  select d.day,
         coalesce(s.sales, 0)::bigint, coalesce(s.commission, 0)::bigint, coalesce(s.n, 0)::bigint,
         coalesce(c.cin, 0)::bigint, coalesce(c.cout, 0)::bigint,
         coalesce(s.fees, 0)::bigint, coalesce(r.cost, 0)::bigint
  from days d
  left join sales s on s.day = d.day
  left join cash  c on c.day = d.day
  left join runs  r on r.day = d.day
  order by d.day;
$$;
revoke execute on function public.daily_revenue(integer) from public, anon;
grant execute on function public.daily_revenue(integer) to authenticated;

-- ═══ Buyer needs board & pre-harvest bookings ════════════════════════════
create type public.need_status as enum ('open', 'matched', 'closed');

create table public.buyer_needs (
  id            uuid primary key default gen_random_uuid(),
  product_id    smallint not null references public.products (id),
  quantity      numeric(12, 2) not null check (quantity > 0),
  unit          public.unit not null,
  max_price_kes integer check (max_price_kes > 0),
  needed_by     date not null,
  location      text not null check (char_length(location) between 2 and 120),
  buyer_name    text not null check (char_length(buyer_name) between 2 and 120),
  buyer_phone   public.ke_phone not null,
  buyer_org     text check (char_length(buyer_org) <= 120),
  note          text check (char_length(note) <= 500),
  status        public.need_status not null default 'open',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index buyer_needs_status_idx on public.buyer_needs (status, needed_by);
create trigger buyer_needs_touch before update on public.buyer_needs
  for each row execute function public.touch_updated_at();

create table public.need_responses (
  id                 uuid primary key default gen_random_uuid(),
  need_id            uuid not null references public.buyer_needs (id) on delete cascade,
  name               text not null check (char_length(name) between 2 and 120),
  phone              public.ke_phone not null,
  quantity           numeric(12, 2) not null check (quantity > 0),
  price_per_unit_kes integer check (price_per_unit_kes > 0),
  note               text check (char_length(note) <= 500),
  handled            boolean not null default false,
  created_at         timestamptz not null default now()
);
create index need_responses_need_idx on public.need_responses (need_id);

alter table public.buyer_needs    enable row level security;
alter table public.need_responses enable row level security;
create policy buyer_needs_admin_all    on public.buyer_needs    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy need_responses_admin_all on public.need_responses for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public view of open needs: no buyer identity or phone.
create or replace function public.open_needs()
returns table (id uuid, product text, product_id smallint, quantity numeric, unit public.unit, max_price_kes integer,
               needed_by date, location text, buyer_type text, responses bigint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, p.name, n.product_id, n.quantity, n.unit, n.max_price_kes, n.needed_by, n.location,
         case when n.buyer_org is not null then 'Business' else 'Individual' end,
         (select count(*) from public.need_responses r where r.need_id = n.id),
         n.created_at
  from public.buyer_needs n join public.products p on p.id = n.product_id
  where n.status = 'open' and n.needed_by >= (now() at time zone 'Africa/Nairobi')::date
  order by n.needed_by
  limit 100;
$$;

create or replace function public.post_buyer_need(
  p_product_id smallint, p_quantity numeric, p_unit public.unit, p_max_price integer, p_needed_by date,
  p_location text, p_name text, p_phone text, p_org text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
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

create or replace function public.respond_to_need(
  p_need_id uuid, p_name text, p_phone text, p_quantity numeric, p_price integer default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.buyer_needs where id = p_need_id and status = 'open') then
    raise exception 'NEED_CLOSED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.need_responses where phone = p_phone and created_at > now() - interval '1 day') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.need_responses (need_id, name, phone, quantity, price_per_unit_kes, note)
  values (p_need_id, btrim(p_name), p_phone, p_quantity, p_price, nullif(btrim(p_note), ''));
end;
$$;

-- ═══ Reviews ═════════════════════════════════════════════════════════════
create table public.order_reviews (
  order_id   uuid primary key references public.orders (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
alter table public.order_reviews enable row level security;
create policy order_reviews_admin_read on public.order_reviews for select to authenticated using (public.is_admin());

create or replace function public.submit_review(p_order_id uuid, p_rating smallint, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.orders where id = p_order_id and status in ('delivered', 'paid')) then
    raise exception 'NOT_DELIVERED' using errcode = 'P0001';
  end if;
  insert into public.order_reviews (order_id, rating, comment)
  values (p_order_id, p_rating, nullif(btrim(p_comment), ''))
  on conflict (order_id) do nothing;
  if not found then raise exception 'ALREADY_REVIEWED' using errcode = 'P0001'; end if;
end;
$$;

-- Latest reviews for the home page: buyer first name only, all ratings (no cherry-picking).
create or replace function public.public_reviews()
returns table (rating smallint, comment text, buyer text, product text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.rating, r.comment, split_part(o.buyer_name, ' ', 1), p.name, r.created_at
  from public.order_reviews r
  join public.orders o on o.id = r.order_id
  join public.listings l on l.id = o.listing_id
  join public.products p on p.id = l.product_id
  where r.comment is not null
  order by r.created_at desc limit 6;
$$;

drop function public.track_order(uuid);
create function public.track_order(p_id uuid)
returns table (status public.order_status, product text, quantity numeric, unit public.unit,
               location text, total_kes integer, created_at timestamptz, reviewed boolean)
language sql stable security definer set search_path = '' as $$
  select o.status, p.name, o.quantity, l.unit, l.location, o.agreed_total_kes + o.delivery_fee_kes, o.created_at,
         exists (select 1 from public.order_reviews r where r.order_id = o.id)
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.products p on p.id = l.product_id
  where o.id = p_id;
$$;

-- ═══ Public stats & price board ══════════════════════════════════════════
create or replace function public.site_stats()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'farmers',      (select count(*) from public.farmers),
    'wards',        (select count(distinct lower(ward)) from public.farmers),
    'listings',     (select count(*) from public.listings where status = 'available'),
    'deliveries',   (select count(*) from public.orders where status in ('delivered', 'paid')),
    'open_needs',   (select count(*) from public.buyer_needs where status = 'open' and needed_by >= (now() at time zone 'Africa/Nairobi')::date),
    'avg_rating',   (select round(avg(rating), 1) from public.order_reviews),
    'review_count', (select count(*) from public.order_reviews),
    'agent_phone',  (select agent_phone from public.settings where id)
  );
$$;

-- Prices per product & unit: listed (now) and sold (last 30 days vs previous 30).
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
  order by p.name;
$$;

-- ═══ Daily digest for Telegram (called by a Vercel cron with a shared secret) ═
create table public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;  -- no policies: unreadable via API
insert into public.app_secrets (name, value) values ('digest', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  on conflict (name) do nothing;

create or replace function public.agent_digest(p_secret text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where name = 'digest') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return json_build_object(
    'yesterday', (select row_to_json(t) from (
        select coalesce(sum(agreed_total_kes), 0) sales, coalesce(sum(commission_kes), 0) commission, count(*) orders
        from public.orders where status in ('confirmed', 'delivered', 'paid')
          and (confirmed_at at time zone 'Africa/Nairobi')::date = v_today - 1) t),
    'week', (select row_to_json(t) from (
        select coalesce(sum(agreed_total_kes), 0) sales, coalesce(sum(commission_kes), 0) commission, count(*) orders
        from public.orders where status in ('confirmed', 'delivered', 'paid')
          and (confirmed_at at time zone 'Africa/Nairobi')::date between v_today - 7 and v_today - 1) t),
    'new_requests',     (select count(*) from public.orders where status = 'new'),
    'overdue_requests', (select count(*) from public.orders where status = 'new' and created_at < now() - interval '24 hours'),
    'open_needs',       (select count(*) from public.buyer_needs where status = 'open' and needed_by >= v_today),
    'new_leads',        (select count(*) from public.farmer_leads where not handled),
    'buyers_owe',       (select coalesce(sum(buyer_owes_kes), 0) from public.order_balances),
    'farmers_owed',     (select coalesce(sum(farmer_owed_kes), 0) from public.order_balances),
    'expiring_soon',    (select count(*) from public.listings l join public.products p on p.id = l.product_id
                         where l.status = 'available' and l.updated_at + make_interval(days => p.shelf_life_days) < now() + interval '2 days')
  );
end;
$$;

-- ═══ Grants for public RPCs ══════════════════════════════════════════════
revoke all on function public.open_needs() from public;
revoke all on function public.post_buyer_need(smallint, numeric, public.unit, integer, date, text, text, text, text, text) from public;
revoke all on function public.respond_to_need(uuid, text, text, numeric, integer, text) from public;
revoke all on function public.submit_review(uuid, smallint, text) from public;
revoke all on function public.public_reviews() from public;
revoke all on function public.track_order(uuid) from public;
revoke all on function public.site_stats() from public;
revoke all on function public.price_board() from public;
revoke all on function public.agent_digest(text) from public;
grant execute on function public.open_needs() to anon, authenticated;
grant execute on function public.post_buyer_need(smallint, numeric, public.unit, integer, date, text, text, text, text, text) to anon, authenticated;
grant execute on function public.respond_to_need(uuid, text, text, numeric, integer, text) to anon, authenticated;
grant execute on function public.submit_review(uuid, smallint, text) to anon, authenticated;
grant execute on function public.public_reviews() to anon, authenticated;
grant execute on function public.track_order(uuid) to anon, authenticated;
grant execute on function public.site_stats() to anon, authenticated;
grant execute on function public.price_board() to anon, authenticated;
grant execute on function public.agent_digest(text) to anon;
