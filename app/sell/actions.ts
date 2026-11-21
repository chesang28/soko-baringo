"use server";
import type { FormState } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { ValidationError, phone, str } from "@/lib/validation";

export async function requestFarmerVisit(_prev: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("website")) return { ok: false, message: "Could not send." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("request_farmer_visit", {
      p_name: str(fd, "name", { min: 2, max: 120 }),
      p_phone: phone(fd, "phone"),
      p_ward: str(fd, "ward", { min: 2, max: 80 }),
      p_produce: str(fd, "produce", { max: 200, required: false }),
    });
    if (error) {
      if (error.message.includes("RATE_LIMITED")) return { ok: false, message: "We already have your details. Our agent will call you soon." };
      console.error("request_farmer_visit failed", error);
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    return { ok: true, message: "Thank you! Our agent will call you within 2 days to register you." };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    throw e;
  }
}
