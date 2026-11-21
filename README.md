# Soko Baringo

A produce marketplace linking Baringo farmers (mangoes, honey and more) directly to buyers.
**Stack:** Next.js 15 (App Router) · Supabase (Postgres, Auth, Storage, RLS, pg_cron) · Tailwind · Vercel

## Features
**Public site (English / Kiswahili)**
- Produce listings with photos and quality grades (A/B/C). Buy requests show a live price estimate, a confirmation screen and a tracking page.
- Buyer requests board: buyers post needs, including pre-harvest bookings, and farmers respond with offers.
- Weekly price board, buyer ratings and reviews, farmer "Sell with us" sign-ups, and a WhatsApp chat button.

**Agent dashboard**
- Orders: the total defaults to quantity × price, with 5% commission calculated automatically. Delivery fees, payments and invoices.
- Stock is updated automatically when orders are confirmed or cancelled. Unsold listings expire automatically each night.
- Money: who owes whom; revenue for today, this week, this month and all time; a 30-day chart; CSV export.
- Ward agents: each agent gets a share of the commission on sales from farmers they registered. Includes a leaderboard and payouts. Only the owner can change settings or pay agents.
- Truck runs: group orders into a trip, charge delivery fees, and print a run sheet.
- Customers directory, printable farmer sales statements, and the buyer requests inbox.

**Alerts (Telegram)**
- Instant alerts for buy requests, farmer sign-ups, buyer requests, farmer offers and ratings.
- A daily summary at 08:00 Kenya time, with a weekly summary on Mondays.

## Setup
1. Run `supabase/migrations/*.sql` in order, in the Supabase SQL editor.
2. Turn off public sign-ups. Create your user, then:
   `insert into admins (user_id, role, commission_share) select id, 'owner', 0 from auth.users where email = '…';`
3. Env vars: see `.env.example`. `CRON_SECRET` must equal `app_secrets.value` where `name = 'digest'`.
4. Deploy on Vercel. `vercel.json` schedules the daily summary.

## Adding a ward agent
In Supabase, go to Authentication → Users → Add user (tick Auto Confirm). Then in the app go to Agents → Add a ward agent, using the same email.
