"use server";
import { after } from "next/server";
import { orderRef } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { notifyAgent, tgEscape } from "@/lib/telegram";
import type { FormState } from "@/lib/types";
import { ValidationError, str, uuid } from "@/lib/validation";

export async function submitReview(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const orderId = uuid(fd, "order_id");
    const rating = Number(fd.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError("Choose 1 to 5 stars.");
    const comment = str(fd, "comment", { max: 500, required: false });
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_review", { p_order_id: orderId, p_rating: rating, p_comment: comment });
    if (error) {
      if (error.message.includes("ALREADY_REVIEWED")) return { ok: true, message: "Already rated. Thank you!" };
      if (error.message.includes("NOT_DELIVERED")) return { ok: false, message: "You can rate once your order is delivered." };
      console.error("submit_review failed", error);
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    after(() => notifyAgent(`⭐ <b>New rating ${"★".repeat(rating)}</b> for ${orderRef(orderId)}${comment ? `\n“${tgEscape(comment)}”` : ""}`));
    return { ok: true, message: "ok" };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    throw e;
  }
}
