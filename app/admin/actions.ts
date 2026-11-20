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

export async function updateOrder(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const patch = {
    status: orderStatus(fd, "status"),
    agreed_total_kes: optionalInt(fd, "agreed_total_kes"),
    commission_kes: optionalInt(fd, "commission_kes"),
  };
  const supabase = await requireAdmin();
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}
