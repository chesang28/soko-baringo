const kes = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" });

export const formatKes = (n: number) => kes.format(n);
export const formatDate = (iso: string) => date.format(new Date(iso));
export const formatQty = (n: number) => Number(n).toLocaleString("en-KE", { maximumFractionDigits: 2 });

/** 2547XXXXXXXX → 07XX XXX XXX for display */
export const displayPhone = (p: string) => `0${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}`;
export const whatsappLink = (p: string, text: string) => `https://wa.me/${p}?text=${encodeURIComponent(text)}`;

/** Short human reference for an order id, e.g. SB-3F9A1C */
export const orderRef = (id: string) => `SB-${id.slice(0, 6).toUpperCase()}`;
export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
