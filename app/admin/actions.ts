"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";
import {
  ValidationError, listingStatus, num, optionalInt, orderStatus, phone, str, unit, uuid,
} from "@/lib/validation";

/** Defence in depth: RLS already enforces this, but fail fast with a clear error. */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Not authorised");
  return supabase;
}

async function run(fn: () => Promise<string>): Promise<FormState> {
  try {
    return { ok: true, message: await fn() };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key") && msg.includes("phone")) return { ok: false, message: "A farmer with this phone already exists." };
    if (msg.includes("INSUFFICIENT_STOCK")) return { ok: false, message: "Not enough stock left on this listing to confirm this order." };
    console.error(e);
    return { ok: false, message: "Could not save. Please try again." };
  }
}

export async function createFarmer(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const row = {
      full_name: str(fd, "full_name", { min: 2, max: 120 }),
      phone: phone(fd, "phone"),
      ward: str(fd, "ward", { min: 2, max: 80 }),
      village: str(fd, "village", { max: 80, required: false }),
      group_name: str(fd, "group_name", { max: 120, required: false }),
      notes: str(fd, "notes", { max: 1000, required: false }),
    };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("farmers").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/farmers");
    return `${row.full_name} registered.`;
  });
}

export async function createListing(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const row = {
      farmer_id: uuid(fd, "farmer_id"),
      product_id: num(fd, "product_id", { integer: true, max: 32767 }),
      quantity: num(fd, "quantity", { max: 1_000_000 }),
      unit: unit(fd, "unit"),
      price_per_unit_kes: num(fd, "price_per_unit_kes", { integer: true, max: 10_000_000 }),
      location: str(fd, "location", { min: 2, max: 120 }),
      available_from: str(fd, "available_from", { min: 10, max: 10 }),
      description: str(fd, "description", { max: 1000, required: false }),
    };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("listings").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/listings");
    revalidatePath("/listings");
    return "Listing published.";
  });
}

export async function updateListing(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const patch = { status: listingStatus(fd, "status"), quantity: num(fd, "quantity", { max: 1_000_000 }) };
  const supabase = await requireAdmin();
  const { error } = await supabase.from("listings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/listings");
  revalidatePath("/listings");
}

export async function updateOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = uuid(fd, "id");
    const patch = {
      status: orderStatus(fd, "status"),
      agreed_total_kes: optionalInt(fd, "agreed_total_kes"),
      commission_kes: optionalInt(fd, "commission_kes"), // blank → auto-calculated by DB trigger
    };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/listings");
    revalidatePath("/admin");
    revalidatePath("/listings");
    return "Saved.";
  });
}

export async function updateSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const percent = num(fd, "commission_percent", { min: -0.0001, max: 50 });
    const rawPhone = String(fd.get("agent_phone") ?? "").trim();
    const agent_phone = rawPhone ? phone(fd, "agent_phone") : null;
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("settings")
      .update({ commission_rate: Math.round(percent * 100) / 10000, agent_phone })
      .eq("id", true);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return "Settings saved.";
  });
}

const DIRECTIONS = ["from_buyer", "to_farmer"] as const;
const METHODS = ["mpesa", "cash", "bank", "other"] as const;

export async function recordPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const direction = String(fd.get("direction"));
    const method = String(fd.get("method"));
    if (!(DIRECTIONS as readonly string[]).includes(direction)) throw new ValidationError("Choose who paid.");
    if (!(METHODS as readonly string[]).includes(method)) throw new ValidationError("Choose a payment method.");
    const row = {
      order_id: uuid(fd, "order_id"),
      direction,
      method,
      amount_kes: num(fd, "amount_kes", { integer: true, max: 100_000_000 }),
      reference: str(fd, "reference", { max: 60, required: false })?.toUpperCase() ?? null,
    };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("payments").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/money");
    revalidatePath("/admin");
    return `Recorded KES ${row.amount_kes.toLocaleString("en-KE")} ${direction === "from_buyer" ? "received from buyer" : "paid to farmer"}.`;
  });
}

export async function setLeadHandled(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("farmer_leads").update({ handled: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/farmers");
  revalidatePath("/admin");
}
