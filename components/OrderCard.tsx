import { ActionForm } from "@/components/ActionForm";
import { CheckIcon } from "@/components/Icons";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { cancelOrder, confirmOrder, markDelivered, recordPayment, updateOrder } from "@/app/admin/actions";
import { displayPhone, formatDate, formatKes, formatQty, orderRef, whatsappLink } from "@/lib/format";
import { productVisual } from "@/lib/products";
import { ORDER_STATUSES, type OrderBalance } from "@/lib/types";
import { DeliveryFields } from "./DeliveryFields";

export type Step = "confirm" | "deliver" | "buyer" | "farmer" | "driver" | "done" | "cancelled";

export function currentStep(b: OrderBalance): Step {
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "new" || b.status === "contacted") return "confirm";
  if (b.status === "confirmed") return "deliver";
  if (b.buyer_owes_kes > 0) return "buyer";
  if (b.farmer_owed_kes > 0) return "farmer";
  if (b.driver_owed_kes > 0) return "driver";
  return "done";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function PayForm({ orderId, direction, amount, label, who }: { orderId: string; direction: string; amount: number; label: string; who: string }) {
  return (
    <ActionForm action={recordPayment} className="space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="direction" value={direction} />
      <p className="text-sm">{who}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-gray-600">Amount (KES)
          <input className="input w-32" name="amount_kes" type="number" min="1" step="1" required defaultValue={amount} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">Via
          <select className="input" name="method" defaultValue="mpesa"><option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="bank">Bank</option></select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">M-Pesa code (optional)
          <input className="input w-36" name="reference" maxLength={60} />
        </label>
        <SubmitButton className="btn">{label}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function OrderCard({ b }: { b: OrderBalance }) {
  const step = currentStep(b);
  const v = productVisual(b.product);
  const hired = b.delivery_method === "hired";
  const due = b.total_kes + b.delivery_fee_kes;
  const overdue = step === "confirm" && Date.now() - new Date(b.created_at).getTime() > DAY_MS;
  const item = `${formatQty(b.quantity)} ${b.unit} of ${b.product}`;

  const steps: { key: Step; label: string; done: boolean; detail?: string }[] = [
    { key: "confirm", label: "Confirmed with buyer", done: !["confirm", "cancelled"].includes(step), detail: `${formatKes(b.total_kes)}${b.delivery_fee_kes ? ` + ${formatKes(b.delivery_fee_kes)} delivery` : ""}` },
    { key: "deliver", label: "Delivered", done: ["buyer", "farmer", "driver", "done"].includes(step), detail: hired ? `by ${b.driver_name ?? "driver"} (costs ${formatKes(b.transport_cost_kes)})` : "buyer collected" },
    { key: "buyer", label: "Buyer paid you", done: ["farmer", "driver", "done"].includes(step) || (b.received_kes >= due && due > 0), detail: formatKes(b.received_kes) },
    { key: "farmer", label: `Paid farmer ${b.farmer_name}`, done: ["driver", "done"].includes(step) || (b.paid_out_kes >= b.farmer_share_kes && b.farmer_share_kes > 0), detail: formatKes(b.paid_out_kes) },
    ...(hired ? [{ key: "driver" as Step, label: `Paid driver ${b.driver_name ?? ""}`, done: step === "done", detail: formatKes(b.driver_paid_kes) }] : []),
  ];

  return (
    <div className={`card ${overdue ? "border-red-400" : ""} ${step === "done" ? "bg-gray-50" : ""}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${v.tint}`} aria-hidden="true">{v.emoji}</span>
          <div>
            <p className="font-semibold">{b.buyer_name}{b.buyer_org ? ` · ${b.buyer_org}` : ""} <span className="font-mono text-xs text-gray-400">{orderRef(b.order_id)}</span></p>
            <p className="text-sm text-gray-600">{item} · from {b.farmer_name}, {b.location}</p>
            {b.note && <p className="text-sm italic text-gray-600">“{b.note}”</p>}
            <p className="text-xs text-gray-500">{formatDate(b.created_at)}{overdue && <span className="ml-2 font-medium text-red-700">⚠ waiting over 24h</span>}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {step === "done" ? <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800">✓ completed</span> : <StatusBadge status={b.status} />}
          <a className="btn-ghost px-3 py-1.5" href={`tel:+${b.buyer_phone}`}>📞 {displayPhone(b.buyer_phone)}</a>
          <a className="btn-ghost px-3 py-1.5" target="_blank" rel="noopener noreferrer"
             href={whatsappLink(b.buyer_phone, `Hello ${b.buyer_name}, this is Soko Baringo about your order ${orderRef(b.order_id)} for ${item}.`)}>WhatsApp</a>
        </div>
      </div>

      {step !== "cancelled" && (
        <>
          {/* Where the money goes */}
          {step !== "confirm" && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm">
              Buyer pays you <b>{formatKes(due)}</b> → farmer gets <b>{formatKes(b.farmer_share_kes)}</b>
              {hired && <> → driver gets <b>{formatKes(b.transport_cost_kes)}</b></>}
              {" "}→ <b className="text-brand-800">you keep {formatKes(b.profit_kes)}</b>
            </p>
          )}

          {/* Checklist */}
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {steps.map((s, i) => (
              <li key={s.key} className={`flex items-center gap-1.5 ${s.done ? "text-brand-800" : step === s.key ? "font-semibold text-gray-900" : "text-gray-400"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${s.done ? "bg-brand-700 text-white" : step === s.key ? "bg-honey-400 text-gray-900" : "bg-gray-200"}`}>
                  {s.done ? <CheckIcon className="h-3 w-3" /> : i + 1}
                </span>
                {s.label}{s.done && s.detail ? <span className="font-normal text-gray-500">· {s.detail}</span> : null}
              </li>
            ))}
          </ol>

          {/* Current step */}
          <div className="mt-3 rounded-xl border-2 border-honey-400/60 bg-amber-50/40 p-4 empty:hidden">
            {step === "confirm" && (
              <ActionForm action={confirmOrder} resetOnSuccess={false} className="space-y-2">
                <p className="font-semibold">Step 1 · Call the buyer and agree the price</p>
                <p className="text-sm text-gray-600">Listed price: {formatQty(b.quantity)} × {formatKes(b.price_per_unit_kes)} = {formatKes(Math.round(b.quantity * b.price_per_unit_kes))}. Change it if you agreed something else.</p>
                <input type="hidden" name="id" value={b.order_id} />
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs text-gray-600">Agreed price for produce (KES)
                    <input className="input w-40" name="agreed_total_kes" type="number" min="0" step="1" required defaultValue={b.total_kes} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-gray-600">Delivery fee buyer pays (KES)
                    <input className="input w-40" name="delivery_fee_kes" type="number" min="0" step="1" defaultValue={b.delivery_fee_kes || 0} />
                  </label>
                  <SubmitButton className="btn">✓ Confirm order</SubmitButton>
                </div>
                <p className="text-xs text-gray-500">Put 0 for delivery if the buyer collects. Your 5% commission is worked out automatically.</p>
              </ActionForm>
            )}

            {step === "deliver" && (
              <ActionForm action={markDelivered} resetOnSuccess={false} className="space-y-2">
                <p className="font-semibold">Step 2 · Deliver the produce</p>
                <input type="hidden" name="id" value={b.order_id} />
                <DeliveryFields defaultFee={b.delivery_fee_kes} />
                <SubmitButton className="btn">🚚 Mark as delivered</SubmitButton>
              </ActionForm>
            )}

            {step === "buyer" && (
              <div className="space-y-2">
                <p className="font-semibold">Step 3 · Collect payment from the buyer</p>
                <PayForm orderId={b.order_id} direction="from_buyer" amount={b.buyer_owes_kes} label="✓ Record payment received"
                         who={`${b.buyer_name} owes ${formatKes(b.buyer_owes_kes)}${b.received_kes ? ` (already paid ${formatKes(b.received_kes)})` : ""}.`} />
              </div>
            )}

            {step === "farmer" && (
              <div className="space-y-2">
                <p className="font-semibold">Step 4 · Pay the farmer</p>
                <PayForm orderId={b.order_id} direction="to_farmer" amount={b.farmer_owed_kes} label="✓ Record payment to farmer"
                         who={`Send ${formatKes(b.farmer_owed_kes)} to ${b.farmer_name} (${displayPhone(b.farmer_phone)}).`} />
              </div>
            )}

            {step === "driver" && (
              <div className="space-y-2">
                <p className="font-semibold">Step 5 · Pay the driver</p>
                <PayForm orderId={b.order_id} direction="to_driver" amount={b.driver_owed_kes} label="✓ Record payment to driver"
                         who={`Send ${formatKes(b.driver_owed_kes)} to ${b.driver_name ?? "the driver"}${b.driver_phone ? ` (${displayPhone(b.driver_phone)})` : ""}.`} />
              </div>
            )}

            {step === "done" && (
              <p className="text-sm text-brand-800">✅ All done. Everyone is paid and you kept <b>{formatKes(b.profit_kes)}</b>.</p>
            )}
          </div>
        </>
      )}

      {/* Rarely needed */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-gray-500">More: edit, invoice, cancel</summary>
        <div className="mt-2 space-y-3 rounded-lg bg-gray-50 p-3">
          {b.status !== "new" && b.status !== "cancelled" && <a className="btn-ghost" href={`/admin/orders/${b.order_id}/invoice`}>🧾 Invoice</a>}
          {(b.status === "delivered" || b.status === "paid") && (
            <ActionForm action={markDelivered} resetOnSuccess={false} className="space-y-2 rounded-lg bg-white p-3 ring-1 ring-gray-200">
              <p className="text-xs font-semibold text-gray-600">Change delivery details (e.g. add a driver you paid)</p>
              <input type="hidden" name="id" value={b.order_id} />
              <DeliveryFields defaultFee={b.delivery_fee_kes} initial={{ method: b.delivery_method, name: b.driver_name, phone: b.driver_phone, cost: b.transport_cost_kes }} />
              <SubmitButton className="btn-ghost">Save delivery details</SubmitButton>
            </ActionForm>
          )}
          <ActionForm action={updateOrder} resetOnSuccess={false}>
            <input type="hidden" name="id" value={b.order_id} />
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-gray-600">Status
                <select className="input py-1 text-sm" name="status" defaultValue={b.status}>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600">Price (KES)<input className="input w-28 py-1 text-sm" name="agreed_total_kes" type="number" min="0" defaultValue={b.total_kes} /></label>
              <label className="flex flex-col gap-1 text-xs text-gray-600">Delivery fee<input className="input w-24 py-1 text-sm" name="delivery_fee_kes" type="number" min="0" defaultValue={b.delivery_fee_kes} /></label>
              <label className="flex flex-col gap-1 text-xs text-gray-600">Commission<input className="input w-24 py-1 text-sm" name="commission_kes" type="number" min="0" defaultValue={b.commission_kes} /></label>
              <SubmitButton className="btn-ghost">Save changes</SubmitButton>
            </div>
          </ActionForm>
          {b.status !== "cancelled" && (
            <form action={cancelOrder}><input type="hidden" name="id" value={b.order_id} />
              <SubmitButton className="btn-ghost text-red-700">Cancel this order</SubmitButton>
            </form>
          )}
        </div>
      </details>
    </div>
  );
}
