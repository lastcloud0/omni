import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        omni: {
          cyan: "#22d3ee",
          blue: "#38bdf8",
          deep: "#0ea5e9",
          glow: "#7dd3fc",
          bg: "#020617",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neon: "0 0 8px rgba(56,189,248,0.6), 0 0 24px rgba(56,189,248,0.35)",
      },
      keyframes: {
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "pulse-ring": {
          "0%,100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "spin-slow": "spin-slow 18s linear infinite",
        "spin-rev": "spin-slow 24s linear infinite reverse",
      },
    },
  },
  plugins: [],
};

export default config;
