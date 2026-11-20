-- Enum values must be committed before use, so this lives in its own migration.
alter type public.listing_status add value if not exists 'expired';
