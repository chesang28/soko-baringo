import { LISTING_STATUSES, ORDER_STATUSES, UNITS, type ListingStatus, type OrderStatus, type Unit } from "./types";

/** Accepts 07.., 01.., +2547.., 2547.., 7.. and returns M-Pesa format 2547XXXXXXXX, or null. */
export function normalizeKenyanPhone(input: string): string | null {
  const n = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const normalized = /^0[17]\d{8}$/.test(n) ? `254${n.slice(1)}` : /^[17]\d{8}$/.test(n) ? `254${n}` : n;
  return /^254[17]\d{8}$/.test(normalized) ? normalized : null;
}

export class ValidationError extends Error {}

export function str(fd: FormData, key: string, { min = 0, max = 500, required = true } = {}): string | null {
  const raw = fd.get(key);
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) {
    if (required) throw new ValidationError(`${label(key)} is required.`);
    return null;
  }
  if (v.length < min || v.length > max) throw new ValidationError(`${label(key)} must be ${min}–${max} characters.`);
  return v;
}

export function num(fd: FormData, key: string, { min = 0, max = 1e9, integer = false } = {}): number {
  const v = Number(fd.get(key));
  if (!Number.isFinite(v) || v <= min || v > max || (integer && !Number.isInteger(v))) {
    throw new ValidationError(`${label(key)} must be a valid ${integer ? "whole " : ""}number.`);
  }
  return v;
}

export function optionalInt(fd: FormData, key: string): number | null {
  const raw = fd.get(key);
  if (raw === null || raw === "") return null;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 0) throw new ValidationError(`${label(key)} must be a whole number ≥ 0.`);
  return v;
}

export function phone(fd: FormData, key: string): string {
  const p = normalizeKenyanPhone(String(fd.get(key) ?? ""));
  if (!p) throw new ValidationError("Enter a valid Kenyan mobile number, e.g. 0712 345 678.");
  return p;
}

export function uuid(fd: FormData, key: string): string {
  const v = String(fd.get(key) ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new ValidationError("Invalid reference.");
  return v;
}

function oneOf<T extends string>(values: readonly T[], what: string) {
  return (fd: FormData, key: string): T => {
    const v = String(fd.get(key) ?? "");
    if (!(values as readonly string[]).includes(v)) throw new ValidationError(`Invalid ${what}.`);
    return v as T;
  };
}

export const unit = oneOf<Unit>(UNITS, "unit");
export const listingStatus = oneOf<ListingStatus>(LISTING_STATUSES, "listing status");
export const orderStatus = oneOf<OrderStatus>(ORDER_STATUSES, "order status");

const label = (key: string) => key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function requireConsent(fd: FormData): void {
  if (fd.get("consent") !== "on") throw new ValidationError("Please tick the box to agree before sending.");
}
