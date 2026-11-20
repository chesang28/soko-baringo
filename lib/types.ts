export const UNITS = ["kg", "crate", "litre", "piece", "bag", "tonne"] as const;
export type Unit = (typeof UNITS)[number];

export const LISTING_STATUSES = ["available", "reserved", "sold_out", "withdrawn", "expired"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ORDER_STATUSES = ["new", "contacted", "confirmed", "delivered", "paid", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Product = { id: number; name: string; default_unit: Unit };

export type Farmer = {
  id: string;
  full_name: string;
  phone: string;
  ward: string;
  village: string | null;
  group_name: string | null;
  created_at: string;
};

export type Listing = {
  id: string;
  farmer_id: string;
  product_id: number;
  quantity: number;
  unit: Unit;
  price_per_unit_kes: number;
  location: string;
  description: string | null;
  available_from: string;
  status: ListingStatus;
  created_at: string;
  products: { name: string } | null;
};

export type Order = {
  id: string;
  listing_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_org: string | null;
  quantity: number;
  note: string | null;
  status: OrderStatus;
  agreed_total_kes: number | null;
  commission_kes: number | null;
  created_at: string;
  listings: { unit: Unit; location: string; products: { name: string } | null } | null;
};

export type FormState = { ok: boolean; message: string } | null;
