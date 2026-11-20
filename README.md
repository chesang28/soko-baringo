# Soko Baringo

A produce marketplace that links Baringo farmers (mangoes, honey and more) directly to buyers.
**Stack:** Next.js 15 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind · Vercel

## How it works (MVP)
- **Agents** (you) register farmers and post their produce from a phone, so farmers don't need smartphones.
- **Buyers** browse `/listings` and send a buy request. They don't need an account.
- **Agents** get the request in `/admin/orders`, call or WhatsApp both sides, then record the agreed total and commission.

## Setup
1. Create a project at supabase.com. In the **SQL Editor**, paste and run `supabase/migrations/0001_init.sql`.
2. Go to **Authentication → Providers → Email** and turn off "Allow new users to sign up".
3. Go to **Authentication → Users → Add user**, create your agent account, then run:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'YOUR_EMAIL';
   ```
4. Copy `.env.example` to `.env.local` and fill it in from **Project Settings → API**.
5. Run `npm install`, then `npm run dev`, and open http://localhost:3000.

## Deploy
Push to GitHub → import the repo in Vercel → add the two `NEXT_PUBLIC_SUPABASE_*` env vars → Deploy.

## Security model
- Farmer phone numbers and all orders are visible to admins only, enforced by Postgres RLS.
- The public can read only `available` listings.
- Buyers can't write to tables directly. The only way in is the `request_order()` function, which checks
  stock and allows at most 5 requests per phone per hour. The form also has a honeypot field against spam bots.
- Phone numbers are stored in M-Pesa format (`2547XXXXXXXX`), ready for Daraja STK push later.

## Roadmap
1. M-Pesa STK push (Daraja) with escrow: the buyer pays, and you pay the farmer after delivery.
2. SMS alerts to farmers and agents (Africa's Talking).
3. Farmers list produce through USSD or WhatsApp.
4. Transport pooling across a ward.
