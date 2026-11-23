"use client";
import { useActionState, useState } from "react";
import { postNeed, respondToNeed } from "@/app/needs/actions";
import type { Dict } from "@/lib/i18n";
import { UNITS, type Product } from "@/lib/types";
import { ConsentBox } from "./ConsentBox";
import { CheckIcon } from "./Icons";
import { SubmitButton } from "./SubmitButton";

const Done = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center py-4 text-center" role="status">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><CheckIcon className="h-7 w-7" /></div>
    <p className="mt-2 font-semibold">{text}</p>
  </div>
);
const Honeypot = () => <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />;

export function PostNeedForm({ products, t, consent }: { products: Product[]; t: Dict["needs"]; consent: string }) {
  const [state, action] = useActionState(postNeed, null);
  const [pid, setPid] = useState(products[0]?.id ?? 0);
  const [unitV, setUnitV] = useState<string>(products[0]?.default_unit ?? "kg");
  if (state?.ok) return <Done text={t.posted} />;
  const today = new Date().toISOString().slice(0, 10);
  const product = products.find((p) => p.id === pid);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Honeypot />
      <input type="hidden" name="product_name" value={product?.name ?? ""} />
      <div>
        <label className="label" htmlFor="n-product">{t.product}</label>
        <select className="input" id="n-product" name="product_id" value={pid}
                onChange={(e) => { const p = products.find((x) => x.id === Number(e.target.value)); setPid(Number(e.target.value)); if (p) setUnitV(p.default_unit); }}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="n-qty">{t.quantity}</label><input className="input" id="n-qty" name="quantity" type="number" min="0.01" step="0.01" required /></div>
        <div>
          <label className="label" htmlFor="n-unit">{t.unit}</label>
          <select className="input" id="n-unit" name="unit" value={unitV} onChange={(e) => setUnitV(e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        </div>
      </div>
      <div><label className="label" htmlFor="n-by">{t.neededBy}</label><input className="input" id="n-by" name="needed_by" type="date" min={today} required /></div>
      <div><label className="label" htmlFor="n-max">{t.maxPrice} <span className="font-normal text-gray-400">{t.optional}</span></label><input className="input" id="n-max" name="max_price" type="number" min="1" step="1" /></div>
      <div><label className="label" htmlFor="n-loc">{t.location}</label><input className="input" id="n-loc" name="location" required placeholder="Nakuru" /></div>
      <div><label className="label" htmlFor="n-name">{t.name}</label><input className="input" id="n-name" name="name" required minLength={2} /></div>
      <div><label className="label" htmlFor="n-phone">{t.phone}</label><input className="input" id="n-phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required /></div>
      <div><label className="label" htmlFor="n-org">{t.business} <span className="font-normal text-gray-400">{t.optional}</span></label><input className="input" id="n-org" name="organisation" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="n-note">{t.note} <span className="font-normal text-gray-400">{t.optional}</span></label><textarea className="input" id="n-note" name="note" rows={2} maxLength={500} /></div>
      <div className="sm:col-span-2"><ConsentBox id="need-consent" text={consent} /></div>
      {state && !state.ok && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2"><SubmitButton className="btn w-full py-3">{t.submit}</SubmitButton></div>
    </form>
  );
}

export function RespondForm({ needId, unit, t, consent }: { needId: string; unit: string; t: Dict["needs"]; consent: string }) {
  const [state, action] = useActionState(respondToNeed, null);
  if (state?.ok) return <Done text={t.offerSent} />;
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-2">
      <Honeypot />
      <input type="hidden" name="need_id" value={needId} />
      <div><label className="label" htmlFor={`r-name-${needId}`}>{t.name}</label><input className="input" id={`r-name-${needId}`} name="name" required minLength={2} /></div>
      <div><label className="label" htmlFor={`r-phone-${needId}`}>{t.phone}</label><input className="input" id={`r-phone-${needId}`} name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required /></div>
      <div><label className="label" htmlFor={`r-qty-${needId}`}>{t.quantity} ({unit})</label><input className="input" id={`r-qty-${needId}`} name="quantity" type="number" min="0.01" step="0.01" required /></div>
      <div><label className="label" htmlFor={`r-price-${needId}`}>{t.yourPrice}</label><input className="input" id={`r-price-${needId}`} name="price" type="number" min="1" step="1" /></div>
      <div className="sm:col-span-2"><ConsentBox id={`r-consent-${needId}`} text={consent} /></div>
      {state && !state.ok && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2"><SubmitButton className="btn w-full">{t.offer}</SubmitButton></div>
    </form>
  );
}
