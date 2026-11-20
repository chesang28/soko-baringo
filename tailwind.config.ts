import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#f3f8ef", 100: "#e2efd9", 600: "#3f7a2a", 700: "#33631f", 800: "#284d19" },
        honey: { 400: "#f2b33d", 500: "#e09b1b" },
      },
    },
  },
  plugins: [],
} satisfies Config;
