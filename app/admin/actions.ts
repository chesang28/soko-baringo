"use server";
import { revalidatePath } from "next/cache";
import { PHOTO_PATH_RE } from "@/lib/photos";
import { GRADES } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";
import {
  ValidationError, listingStatus, num, optionalInt, orderStatus, phone, str, unit, uuid,
} from "@/lib/validation";

/** Defence in depth: RLS already enforces this, but fail fast with a clear error. */
function optionalPhoto(fd: FormData): string | null {
  const v = String(fd.get("photo_path") ?? "").trim();
  if (!v) return null;
  if (!PHOTO_PATH_RE.test(v)) throw new ValidationError("Invalid photo.");
  return v;
}

function optionalGrade(fd: FormData) {
  const v = String(fd.get("grade") ?? "");
  if (!v) return null;
  if (!(GRADES as readonly string[]).includes(v)) throw new ValidationError("Invalid grade.");
  return v;
}

async function requireOwner() {
  const supabase = await requireAdmin();
  const { data } = await supabase.rpc("is_owner");
  if (!data) throw new ValidationError("Only the owner can do this.");
  return supabase;
}

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
    if (msg.includes("USER_NOT_FOUND")) return { ok: false, message: "No user with that email. Create them first in Supabase → Authentication → Users." };
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
      photo_path: optionalPhoto(fd),
      grade: optionalGrade(fd),
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
  const patch = { status: listingStatus(fd, "status"), quantity: num(fd, "quantity", { max: 1_000_000 }), grade: optionalGrade(fd) };
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
      delivery_fee_kes: optionalInt(fd, "delivery_fee_kes") ?? 0,
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

export async function setListingPhoto(listingId: string, path: string): Promise<{ ok: boolean; message: string }> {
  const fd = new FormData(); fd.set("id", listingId); fd.set("photo_path", path);
  return (await run(async () => {
    const id = uuid(fd, "id");
    const photo_path = optionalPhoto(fd);
    const supabase = await requireAdmin();
    const { error } = await supabase.from("listings").update({ photo_path }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/listings"); revalidatePath("/listings"); revalidatePath("/");
    return "Photo updated.";
  }))!;
}

export async function updateSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const percent = num(fd, "commission_percent", { min: -0.0001, max: 50 });
    const rawPhone = String(fd.get("agent_phone") ?? "").trim();
    const agent_phone = rawPhone ? phone(fd, "agent_phone") : null;
    const supabase = await requireOwner();
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

// ─── Buyer needs ────────────────────────────────────────────────────────
const NEED_STATUSES = ["open", "matched", "closed"] as const;
export async function updateNeedStatus(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const status = String(fd.get("status"));
  if (!(NEED_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("buyer_needs").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/needs"); revalidatePath("/needs");
}

export async function markResponseHandled(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("need_responses").update({ handled: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/needs");
}

// ─── Agents ─────────────────────────────────────────────────────────────
export async function addAgent(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const email = str(fd, "email", { min: 5, max: 200 })!;
    const share = num(fd, "share_percent", { min: -0.0001, max: 100 });
    const supabase = await requireOwner();
    const { error } = await supabase.rpc("add_agent", {
      p_email: email, p_name: str(fd, "full_name", { min: 2, max: 120 }), p_ward: str(fd, "ward", { max: 80, required: false }) ?? "",
      p_share: Math.round(share * 10) / 1000,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/agents");
    return "Agent saved. They can now sign in.";
  });
}

export async function updateAgent(fd: FormData): Promise<void> {
  const id = uuid(fd, "agent_id");
  const share = num(fd, "share_percent", { min: -0.0001, max: 100 });
  const supabase = await requireOwner();
  const { error } = await supabase.from("admins")
    .update({ commission_share: Math.round(share * 10) / 1000, active: fd.get("active") === "on" })
    .eq("user_id", id).eq("role", "agent");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agents");
}

export async function payAgent(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const method = String(fd.get("method"));
    if (!(METHODS as readonly string[]).includes(method)) throw new ValidationError("Choose a payment method.");
    const row = {
      agent_id: uuid(fd, "agent_id"),
      amount_kes: num(fd, "amount_kes", { integer: true, max: 100_000_000 }),
      method,
      reference: str(fd, "reference", { max: 60, required: false })?.toUpperCase() ?? null,
    };
    const supabase = await requireOwner();
    const { error } = await supabase.from("agent_payouts").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/agents"); revalidatePath("/admin/money");
    return `Recorded KES ${row.amount_kes.toLocaleString("en-KE")} paid to agent.`;
  });
}

// ─── Delivery runs ──────────────────────────────────────────────────────
const RUN_STATUSES = ["planned", "on_route", "done"] as const;
export async function createRun(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const driverPhone = String(fd.get("driver_phone") ?? "").trim();
    const row = {
      run_date: str(fd, "run_date", { min: 10, max: 10 }),
      route: str(fd, "route", { min: 2, max: 120 }),
      vehicle: str(fd, "vehicle", { max: 60, required: false }),
      driver_name: str(fd, "driver_name", { max: 120, required: false }),
      driver_phone: driverPhone ? phone(fd, "driver_phone") : null,
      cost_kes: optionalInt(fd, "cost_kes") ?? 0,
    };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("delivery_runs").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/runs");
    return "Run planned.";
  });
}

export async function updateRun(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const status = String(fd.get("status"));
  if (!(RUN_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("delivery_runs").update({ status, cost_kes: optionalInt(fd, "cost_kes") ?? 0 }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/runs/${id}`); revalidatePath("/admin/runs"); revalidatePath("/admin/money");
}

export async function assignToRun(fd: FormData): Promise<void> {
  const runId = uuid(fd, "run_id");
  const ids = fd.getAll("order_id").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const fee = optionalInt(fd, "delivery_fee_kes");
  if (!ids.length) return;
  const supabase = await requireAdmin();
  const patch: { run_id: string; delivery_fee_kes?: number } = { run_id: runId };
  if (fee !== null) patch.delivery_fee_kes = fee;
  const { error } = await supabase.from("orders").update(patch).in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/runs/${runId}`); revalidatePath("/admin/runs"); revalidatePath("/admin/orders");
}

export async function removeFromRun(fd: FormData): Promise<void> {
  const id = uuid(fd, "order_id");
  const runId = uuid(fd, "run_id");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("orders").update({ run_id: null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/runs/${runId}`);
}
