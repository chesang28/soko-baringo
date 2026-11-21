-- "Notify me when available": buyers waiting for a product to come into stock.

create table public.stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  product_id  smallint not null references public.products (id),
  name        text not null check (char_length(name) between 2 and 120),
  phone       public.ke_phone not null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
-- One open alert per phone per product.
create unique index stock_alerts_open_uniq on public.stock_alerts (product_id, phone) where notified_at is null;
create index stock_alerts_product_idx on public.stock_alerts (product_id) where notified_at is null;

alter table public.stock_alerts enable row level security;
create policy stock_alerts_admin_all on public.stock_alerts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.subscribe_stock_alert(p_product_id smallint, p_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.stock_alerts where phone = p_phone and created_at > now() - interval '1 day') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.stock_alerts (product_id, name, phone)
  values (p_product_id, btrim(p_name), p_phone)
  on conflict (product_id, phone) where notified_at is null do nothing;
end;
$$;
revoke all on function public.subscribe_stock_alert(smallint, text, text) from public;
grant execute on function public.subscribe_stock_alert(smallint, text, text) to anon, authenticated;
