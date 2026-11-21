"use client";
import { useState } from "react";

/** Pickup vs hired transport. Only asks for driver details when needed. */
export function DeliveryFields({ defaultFee }: { defaultFee: number }) {
  const [method, setMethod] = useState<"pickup" | "hired">(defaultFee > 0 ? "hired" : "pickup");
  const [cost, setCost] = useState("");
  const profit = defaultFee - (Number(cost) || 0);
  const opt = (on: boolean) => `flex-1 cursor-pointer rounded-lg border-2 p-3 text-sm ${on ? "border-brand-700 bg-white" : "border-gray-200 bg-white/60"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={opt(method === "pickup")}>
          <input type="radio" name="delivery_method" value="pickup" checked={method === "pickup"} onChange={() => setMethod("pickup")} className="mr-2" />
          <b>Buyer collected</b><span className="block text-xs text-gray-500">No transport cost</span>
        </label>
        <label className={opt(method === "hired")}>
          <input type="radio" name="delivery_method" value="hired" checked={method === "hired"} onChange={() => setMethod("hired")} className="mr-2" />
          <b>I hired transport</b><span className="block text-xs text-gray-500">Matatu, pickup, boda or truck</span>
        </label>
      </div>
      {method === "hired" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-600">Driver name<input className="input w-40" name="driver_name" required minLength={2} /></label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">Driver phone (optional)<input className="input w-36" name="driver_phone" type="tel" placeholder="0712 345 678" /></label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">What you pay the driver (KES)
            <input className="input w-36" name="transport_cost_kes" type="number" min="0" step="1" required value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          {cost !== "" && (
            <p className={`pb-2 text-sm ${profit >= 0 ? "text-brand-700" : "text-red-700"}`}>
              Buyer pays {defaultFee.toLocaleString("en-KE")} for delivery → you {profit >= 0 ? "keep" : "lose"} KES {Math.abs(profit).toLocaleString("en-KE")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
