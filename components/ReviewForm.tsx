"use client";
import { useActionState, useState } from "react";
import { submitReview } from "@/app/track/actions";
import type { Dict } from "@/lib/i18n";
import { SubmitButton } from "./SubmitButton";

export function ReviewForm({ orderId, t }: { orderId: string; t: Dict["track"] }) {
  const [state, action] = useActionState(submitReview, null);
  const [rating, setRating] = useState(0);
  if (state?.ok) return <p className="rounded-2xl bg-brand-50 p-4 text-center font-semibold text-brand-800">⭐ {t.thanks}</p>;

  return (
    <form action={action} className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <h2 className="text-lg font-bold">{t.rate}</h2>
      <p className="text-sm text-gray-600">{t.rateSub}</p>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <div className="my-3 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`}
                  onClick={() => setRating(n)} className={`text-4xl transition ${n <= rating ? "text-honey-500" : "text-gray-300 hover:text-honey-400"}`}>★</button>
        ))}
      </div>
      <label className="label" htmlFor="comment">{t.comment}</label>
      <textarea className="input" id="comment" name="comment" rows={2} maxLength={500} />
      {state && !state.ok && <p role="alert" className="mt-2 text-sm text-red-700">{state.message}</p>}
      <div className="mt-3"><SubmitButton className="btn w-full">{t.submitReview}</SubmitButton></div>
    </form>
  );
}
