"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAgent, siteUrl, tgEscape } from "@/lib/telegram";
import type { FormState } from "@/lib/types";
import { ValidationError, num, phone, requireConsent, str, unit, uuid } from "@/lib/validation";

const fail = (msg: string, map: Record<string, string>) => {
  const k = Object.keys(map).find((x) => msg.includes(x));
  return { ok: false, message: k ? map[k] : "Something went wrong. Please try again." };
};

export async function postNeed(_prev: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("website")) return { ok: false, message: "Could not send." };
  try {
    requireConsent(fd);
    const maxRaw = String(fd.get("max_price") ?? "").trim();
    const input = {
      p_product_id: num(fd, "product_id", { integer: true, max: 32767 }),
      p_quantity: num(fd, "quantity", { max: 10_000_000 }),
      p_unit: unit(fd, "unit"),
      p_max_price: maxRaw ? num(fd, "max_price", { integer: true, max: 10_000_000 }) : null,
      p_needed_by: str(fd, "needed_by", { min: 10, max: 10 })!,
      p_location: str(fd, "location", { min: 2, max: 120 })!,
      p_name: str(fd, "name", { min: 2, max: 120 })!,
      p_phone: phone(fd, "phone"),
      p_org: str(fd, "organisation", { max: 120, required: false }),
      p_note: str(fd, "note", { max: 500, required: false }),
    };
    const supabase = await createClient();
    const { error } = await supabase.rpc("post_buyer_need", input);
    if (error) {
      console.error("post_buyer_need", error);
      return fail(error.message, { RATE_LIMITED: "You've posted several requests today. Please try tomorrow.", INVALID_DATE: "Choose a date between today and one year ahead.", PRODUCT_UNAVAILABLE: "We are not taking requests for this crop right now." });
    }
    const product = String(fd.get("product_name") ?? "").slice(0, 60);
    const { data: stock } = await supabase.from("listings").select("quantity, unit, price_per_unit_kes, location")
      .eq("product_id", input.p_product_id).eq("status", "available").order("price_per_unit_kes").limit(5);
    const inStock = (stock ?? []) as { quantity: number; unit: string; price_per_unit_kes: number; location: string }[];
    after(() => notifyAgent([
      `📋 <b>New buyer request</b>`,
      `${input.p_quantity} ${input.p_unit} of <b>${tgEscape(product)}</b> by ${input.p_needed_by}`,
      input.p_max_price ? `💰 up to KES ${input.p_max_price}/${input.p_unit}` : "",
      `📍 ${tgEscape(input.p_location)}`,
      `👤 ${tgEscape(input.p_name)}${input.p_org ? `, ${tgEscape(input.p_org)}` : ""} · +${input.p_phone}`,
      inStock.length ? `\n🎯 <b>Already in stock:</b>\n${inStock.map((l) => `• ${l.quantity} ${l.unit} @ KES ${l.price_per_unit_kes} in ${tgEscape(l.location)}`).join("\n")}` : "",
      `\n<a href="${siteUrl()}/admin/needs">Open buyer requests</a>`,
    ].filter(Boolean).join("\n")));
    revalidatePath("/needs");
    return { ok: true, message: "posted" };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    throw e;
  }
}

export async function respondToNeed(_prev: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("website")) return { ok: false, message: "Could not send." };
  try {
    requireConsent(fd);
    const priceRaw = String(fd.get("price") ?? "").trim();
    const input = {
      p_need_id: uuid(fd, "need_id"),
      p_name: str(fd, "name", { min: 2, max: 120 })!,
      p_phone: phone(fd, "phone"),
      p_quantity: num(fd, "quantity", { max: 10_000_000 }),
      p_price: priceRaw ? num(fd, "price", { integer: true, max: 10_000_000 }) : null,
      p_note: str(fd, "note", { max: 500, required: false }),
    };
    const supabase = await createClient();
    const { error } = await supabase.rpc("respond_to_need", input);
    if (error) {
      console.error("respond_to_need", error);
      return fail(error.message, { NEED_CLOSED: "This request is no longer open.", RATE_LIMITED: "Too many offers today. Please try tomorrow." });
    }
    after(() => notifyAgent([
      `🤝 <b>Farmer offer on a buyer request</b>`,
      `${tgEscape(input.p_name)} can supply ${input.p_quantity}${input.p_price ? ` at KES ${input.p_price}` : ""}`,
      `📞 +${input.p_phone}`,
      `\n<a href="${siteUrl()}/admin/needs">Open buyer requests</a>`,
    ].join("\n")));
    revalidatePath("/needs");
    return { ok: true, message: "sent" };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    throw e;
  }
}
