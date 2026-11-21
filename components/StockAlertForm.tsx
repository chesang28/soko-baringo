"use client";
import { useActionState } from "react";
import { subscribeStockAlert } from "@/app/listings/alert-actions";
import type { Dict } from "@/lib/i18n";
import { CheckIcon } from "./Icons";
import { SubmitButton } from "./SubmitButton";

export function StockAlertForm({ productId, productName, t }: { productId: number; productName: string; t: Dict["alert"] }) {
  const [state, action] = useActionState(subscribeStockAlert, null);
  if (state?.ok) {
    return <p className="flex items-center justify-center gap-2 rounded-xl bg-brand-50 p-4 font-semibold text-brand-800" role="status"><CheckIcon />{t.done}</p>;
  }
  return (
    <form action={action} className="mx-auto max-w-md space-y-3 text-left">
      <p className="text-center font-semibold">🔔 {t.title}</p>
      <p className="text-center text-sm text-gray-600">{t.sub}</p>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="product_name" value={productName} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className="label" htmlFor="sa-name">{t.name}</label><input className="input" id="sa-name" name="name" required minLength={2} /></div>
        <div><label className="label" htmlFor="sa-phone">{t.phone}</label><input className="input" id="sa-phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required /></div>
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
      <SubmitButton className="btn w-full">{t.submit}</SubmitButton>
    </form>
  );
}
