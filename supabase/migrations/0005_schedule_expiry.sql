-- Nightly expiry at 00:00 UTC (03:00 Kenya time). Requires pg_cron (enabled by default on Supabase).
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-listings';
select cron.schedule('expire-stale-listings', '0 0 * * *', 'select public.expire_stale_listings()');
