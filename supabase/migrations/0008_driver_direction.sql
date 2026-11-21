-- Enum values must be committed before use, so this lives in its own migration.
alter type public.payment_direction add value if not exists 'to_driver';
