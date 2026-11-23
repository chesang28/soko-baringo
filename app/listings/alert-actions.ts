"use server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAgent, siteUrl, tgEscape } from "@/lib/telegram";
import type { FormState } from "@/lib/types";
import { ValidationError, num, phone, requireConsent, str } from "@/lib/validation";

export async function subscribeStockAlert(_prev: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("website")) return { ok: false, message: "Could not send." };
  try {
    requireConsent(fd);
    const input = {
      p_product_id: num(fd, "product_id", { integer: true, max: 32767 }),
      p_name: str(fd, "name", { min: 2, max: 120 })!,
      p_phone: phone(fd, "phone"),
    };
    const supabase = await createClient();
    const { error } = await supabase.rpc("subscribe_stock_alert", input);
    if (error) {
      if (error.message.includes("PRODUCT_UNAVAILABLE")) return { ok: false, message: "We are not taking requests for this crop right now." };
      if (error.message.includes("RATE_LIMITED")) return { ok: false, message: "Too many requests today. Please try tomorrow." };
      console.error("subscribe_stock_alert", error);
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    const product = String(fd.get("product_name") ?? "").slice(0, 60);
    after(() => notifyAgent(`🔔 <b>${tgEscape(input.p_name)}</b> wants to be told when <b>${tgEscape(product)}</b> is in stock · +${input.p_phone}\n<a href="${siteUrl()}/admin/customers">Waiting list</a>`));
    return { ok: true, message: "ok" };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    throw e;
  }
}
