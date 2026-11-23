"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { requestOrder } from "@/app/listings/[id]/actions";
import type { Dict } from "@/lib/i18n";
import { formatKes, orderRef, whatsappLink } from "@/lib/format";
import { ConsentBox } from "./ConsentBox";
import { CheckIcon } from "./Icons";
import { SubmitButton } from "./SubmitButton";

type Props = { listingId: string; product: string; unit: string; maxQty: number; price: number; agentPhone: string | null; t: Dict["order"]; consent: string };

export function OrderForm({ listingId, product, unit, maxQty, price, agentPhone, t, consent }: Props) {
  const [state, action] = useActionState(requestOrder, null);
  const [qty, setQty] = useState("");
  const estimate = Number(qty) > 0 ? Math.round(Number(qty) * price) : 0;

  if (state?.ok && state.data?.id) {
    const ref = orderRef(state.data.id);
    return (
      <div className="text-center" role="status" aria-live="polite">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <CheckIcon className="h-9 w-9" />
        </div>
        <h2 className="mt-4 text-2xl font-bold">{t.sent}</h2>
        <p className="mt-1 text-gray-600">{t.ref}</p>
        <p className="mt-1 inline-block rounded-lg bg-gray-100 px-4 py-2 font-mono text-xl font-bold tracking-wider">{ref}</p>
        <ol className="mx-auto mt-6 max-w-xs space-y-3 text-left text-sm">
          {t.steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-2">
          <Link href={`/track/${state.data.id}`} className="btn">{t.track}</Link>
          {agentPhone && (
            <a className="btn-ghost justify-center py-2.5" target="_blank" rel="noopener noreferrer"
               href={whatsappLink(agentPhone, `Hello, I just requested ${product}. Reference ${ref}.`)}>
              {t.whatsapp}
            </a>
          )}
          <Link href="/listings" className="text-sm text-brand-700">{t.more}</Link>
        </div>
        <p className="mt-4 text-xs text-gray-500">{t.save}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="price" value={price} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <label className="label" htmlFor="quantity">{t.howMany} ({unit})?</label>
        <input className="input" id="quantity" name="quantity" type="number" min="0.01" step="0.01" max={maxQty}
               required value={qty} onChange={(e) => setQty(e.target.value)} placeholder={`${t.upTo} ${maxQty}`} />
      </div>
      {estimate > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
          <span className="text-gray-700">{t.estimate}</span>
          <span className="text-lg font-bold text-brand-700">{formatKes(estimate)}</span>
        </div>
      )}
      <div>
        <label className="label" htmlFor="name">{t.name}</label>
        <input className="input" id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="phone">{t.phone}</label>
        <input className="input" id="phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="organisation">{t.business} <span className="font-normal text-gray-400">{t.optional}</span></label>
        <input className="input" id="organisation" name="organisation" maxLength={120} />
      </div>
      <div>
        <label className="label" htmlFor="note">{t.note} <span className="font-normal text-gray-400">{t.optional}</span></label>
        <textarea className="input" id="note" name="note" rows={2} maxLength={500} placeholder={t.notePh} />
      </div>
      <ConsentBox id="order-consent" text={consent} />
      {state && !state.ok && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>}
      <SubmitButton className="btn w-full py-3 text-lg">{t.send}</SubmitButton>
      <p className="text-center text-xs text-gray-500">{t.noPay}</p>
    </form>
  );
}
