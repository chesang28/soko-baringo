"use server";
import { after } from "next/server";
import { formatKes, orderRef } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { notifyAgent, siteUrl, tgEscape } from "@/lib/telegram";
import type { FormState } from "@/lib/types";
import { ValidationError, num, phone, requireConsent, str, uuid } from "@/lib/validation";

const DB_ERRORS: Record<string, string> = {
  LISTING_UNAVAILABLE: "Sorry, this produce is no longer available.",
  INVALID_QUANTITY: "Requested quantity is more than what is available.",
  RATE_LIMITED: "Too many requests from this number. Please try again later.",
};

export async function requestOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  // Honeypot: real users never fill this hidden field.
  if (fd.get("website")) return { ok: false, message: "Could not send request." };

  try {
    requireConsent(fd);
    const input = {
      p_listing_id: uuid(fd, "listing_id"),
      p_buyer_name: str(fd, "name", { min: 2, max: 120 })!,
      p_buyer_phone: phone(fd, "phone"),
      p_quantity: num(fd, "quantity", { max: 1_000_000 }),
      p_buyer_org: str(fd, "organisation", { max: 120, required: false }),
      p_note: str(fd, "note", { max: 500, required: false }),
    };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_order", input);

    if (error) {
      const known = Object.keys(DB_ERRORS).find((k) => error.message.includes(k));
      if (known) return { ok: false, message: DB_ERRORS[known] };
      console.error("request_order failed", error);
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    const id = String(data);
    const product = String(fd.get("product") ?? "produce").slice(0, 60);
    const unit = String(fd.get("unit") ?? "").slice(0, 20);
    const price = Number(fd.get("price")) || 0;
    after(() =>
      notifyAgent(
        [
          `🛒 <b>New buy request</b> ${orderRef(id)}`,
          `${input.p_quantity} ${tgEscape(unit)} of <b>${tgEscape(product)}</b>${price ? ` (about ${formatKes(Math.round(input.p_quantity * price))})` : ""}`,
          `👤 ${tgEscape(input.p_buyer_name)}${input.p_buyer_org ? `, ${tgEscape(input.p_buyer_org)}` : ""}`,
          `📞 +${input.p_buyer_phone}`,
          input.p_note ? `📝 ${tgEscape(input.p_note)}` : "",
          `\n<a href="${siteUrl()}/admin/orders">Open orders</a>`,
        ].filter(Boolean).join("\n"),
      ),
    );
    return { ok: true, message: "Request sent!", data: { id } };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    throw e;
  }
}
