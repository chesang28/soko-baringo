-- Addresses Supabase security advisor findings.
--
-- Intentionally NOT changed (advisor warnings are expected):
--   * is_admin()      – must stay executable by anon/authenticated because RLS policies call it.
--   * request_order() – the single, validated public entry point for buyer requests.

-- Pin search_path on the trigger function (function_search_path_mutable).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Supabase's auto-RLS event-trigger helper doesn't need to be reachable via the REST API.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace) then
    revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
  end if;
end;
$$;
