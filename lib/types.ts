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

export type FormState = { ok: boolean; message: string; data?: Record<string, string> } | null;

export type SiteStats = { farmers: number; wards: number; listings: number; deliveries: number; agent_phone: string | null };

export type OrderBalance = {
  order_id: string;
  status: OrderStatus;
  created_at: string;
  confirmed_at: string | null;
  buyer_name: string;
  buyer_phone: string;
  buyer_org: string | null;
  farmer_id: string;
  farmer_name: string;
  farmer_phone: string;
  total_kes: number;
  commission_kes: number;
  farmer_share_kes: number;
  received_kes: number;
  paid_out_kes: number;
  buyer_owes_kes: number;
  farmer_owed_kes: number;
};

export type Payment = {
  id: string;
  order_id: string;
  direction: "from_buyer" | "to_farmer";
  amount_kes: number;
  method: "mpesa" | "cash" | "bank" | "other";
  reference: string | null;
  paid_at: string;
};

export type DailyRevenue = {
  day: string;
  sales_kes: number;
  commission_kes: number;
  orders: number;
  cash_in_kes: number;
  cash_out_kes: number;
};
