export const UNITS = ["kg", "crate", "litre", "piece", "bag", "tonne"] as const;
export type Unit = (typeof UNITS)[number];

export const LISTING_STATUSES = ["available", "reserved", "sold_out", "withdrawn", "expired"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ORDER_STATUSES = ["new", "contacted", "confirmed", "delivered", "paid", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const GRADES = ["A", "B", "C"] as const;
export type Grade = (typeof GRADES)[number];

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
  photo_path: string | null;
  grade: Grade | null;
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
  delivery_fee_kes?: number;
  created_at: string;
  listings: { unit: Unit; location: string; products: { name: string } | null } | null;
};

export type FormState = { ok: boolean; message: string; data?: Record<string, string> } | null;

export type SiteStats = {
  farmers: number; wards: number; listings: number; deliveries: number; open_needs: number;
  avg_rating: number | null; review_count: number; agent_phone: string | null;
};

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
  delivered_at: string | null;
  run_id: string | null;
  agent_id: string | null;
  quantity: number;
  product: string;
  unit: Unit;
  total_kes: number;
  commission_kes: number;
  farmer_share_kes: number;
  delivery_fee_kes: number;
  note: string | null;
  price_per_unit_kes: number;
  location: string;
  delivery_method: "pickup" | "hired";
  driver_name: string | null;
  driver_phone: string | null;
  transport_cost_kes: number;
  driver_paid_kes: number;
  driver_owed_kes: number;
  profit_kes: number;
  received_kes: number;
  paid_out_kes: number;
  buyer_owes_kes: number;
  farmer_owed_kes: number;
};

export type Payment = {
  id: string;
  order_id: string;
  direction: "from_buyer" | "to_farmer" | "to_driver";
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
  delivery_fees_kes: number;
  transport_cost_kes: number;
};

export type AgentEarning = {
  agent_id: string; full_name: string | null; ward: string | null; role: "owner" | "agent";
  commission_share: number; active: boolean; farmers: number; sales_kes: number; commission_kes: number;
  earned_kes: number; paid_kes: number;
};

export type OpenNeed = {
  id: string; product: string; product_id: number; quantity: number; unit: Unit; max_price_kes: number | null;
  needed_by: string; location: string; buyer_type: string; responses: number; created_at: string;
};
