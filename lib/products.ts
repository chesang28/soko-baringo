// Visual identity per product. Tailwind classes must be literal strings for JIT.
const VISUALS: Record<string, { emoji: string; tint: string }> = {
  Mangoes:       { emoji: "🥭", tint: "bg-amber-100" },
  Honey:         { emoji: "🍯", tint: "bg-yellow-100" },
  Pawpaw:        { emoji: "🍈", tint: "bg-orange-100" },
  Oranges:       { emoji: "🍊", tint: "bg-orange-100" },
  Bananas:       { emoji: "🍌", tint: "bg-yellow-100" },
  Groundnuts:    { emoji: "🥜", tint: "bg-amber-100" },
  Sorghum:       { emoji: "🌾", tint: "bg-lime-100" },
  "Green grams": { emoji: "🫘", tint: "bg-green-100" },
  Avocados:      { emoji: "🥑", tint: "bg-lime-100" },
  "Aloe vera":   { emoji: "🌿", tint: "bg-emerald-100" },
};

export const productVisual = (name?: string | null) => VISUALS[name ?? ""] ?? { emoji: "🧺", tint: "bg-brand-100" };
