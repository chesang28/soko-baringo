"use server";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";
import { ValidationError, num, phone, str, uuid } from "@/lib/validation";

const DB_ERRORS: Record<string, string> = {
  LISTING_UNAVAILABLE: "Sorry, this produce is no longer available.",
  INVALID_QUANTITY: "Requested quantity is more than what is available.",
  RATE_LIMITED: "Too many requests from this number. Please try again later.",
};

export async function requestOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  // Honeypot: real users never fill this hidden field.
  if (fd.get("website")) return { ok: true, message: "Request received." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("request_order", {
      p_listing_id: uuid(fd, "listing_id"),
      p_buyer_name: str(fd, "name", { min: 2, max: 120 }),
      p_buyer_phone: phone(fd, "phone"),
      p_quantity: num(fd, "quantity", { max: 1_000_000 }),
      p_buyer_org: str(fd, "organisation", { max: 120, required: false }),
      p_note: str(fd, "note", { max: 500, required: false }),
    });

    if (error) {
      const known = Object.keys(DB_ERRORS).find((k) => error.message.includes(k));
      if (known) return { ok: false, message: DB_ERRORS[known] };
      console.error("request_order failed", error);
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    return { ok: true, message: "Request sent! Our agent will call you shortly to confirm." };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    throw e;
  }
}
