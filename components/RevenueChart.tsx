"use client";
import { useState } from "react";
import type { DailyRevenue } from "@/lib/types";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" });

/** Single-series bar chart: daily sales. Hover/focus a bar for details. */
export function RevenueChart({ days }: { days: DailyRevenue[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = 158, PAD_L = 0, PAD_B = 0, GAP = 2;
  const max = Math.max(1, ...days.map((d) => d.sales_kes));
  const slot = (W - PAD_L) / days.length;
  const barW = Math.max(2, slot - GAP);
  const plotH = H - PAD_B;
  const h = hover !== null ? days[hover] : null;

  const bar = (x: number, y: number, w: number, hgt: number) => {
    if (hgt <= 0) return "";
    const r = Math.min(4, w / 2, hgt);
    return `M${x},${y + hgt} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + hgt} Z`;
  };

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${plotH}`} preserveAspectRatio="none" className="h-44 w-full" role="img" aria-label="Daily sales for the last 30 days" onMouseLeave={() => setHover(null)}>
          {[0.5, 1].map((t) => (
            <line key={t} x1={0} x2={W} y1={plotH - (plotH - 8) * t} y2={plotH - (plotH - 8) * t} stroke="#e5e7eb" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={0} x2={W} y1={plotH - 0.5} y2={plotH - 0.5} stroke="#d1d5db" vectorEffect="non-scaling-stroke" />
          {days.map((d, i) => {
            const hgt = (d.sales_kes / max) * (plotH - 8);
            const x = PAD_L + i * slot + GAP / 2;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${short(d.day)}: ${kes(d.sales_kes)}`}>
                <rect x={x - GAP / 2} y={0} width={slot} height={plotH} fill="transparent" />
                <path d={bar(x, plotH - hgt, barW, hgt)} fill={hover === i ? "#284d19" : "#3f7a2a"} />
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>{days[0] && short(days[0].day)}</span>
          <span>{days.length > 2 && short(days[Math.floor(days.length / 2)].day)}</span>
          <span>{days.at(-1) && short(days.at(-1)!.day)}</span>
        </div>
        <span className="absolute right-0 top-0 rounded bg-white/80 px-1 text-xs text-gray-500">max {kes(max)}</span>
        {h && hover !== null && (
          <div className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
               style={{ left: `${Math.min(85, Math.max(15, ((hover + 0.5) / days.length) * 100))}%` }}>
            <p className="font-semibold">{short(h.day)}</p>
            <p>Sales: {kes(h.sales_kes)}</p>
            <p>Commission: {kes(h.commission_kes)}</p>
            <p>Orders: {h.orders}</p>
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-gray-500">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-gray-500"><tr><th>Day</th><th>Sales</th><th>Commission</th><th>Orders</th></tr></thead>
          <tbody>
            {days.filter((d) => d.sales_kes || d.orders).reverse().map((d) => (
              <tr key={d.day}><td>{short(d.day)}</td><td>{kes(d.sales_kes)}</td><td>{kes(d.commission_kes)}</td><td>{d.orders}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
