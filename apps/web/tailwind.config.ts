import type { Config } from "tailwindcss";

/**
 * BELT-KIT — "Light Slate + Violet" Enterprise theme.
 * Warm off-white canvas, slate surfaces, electric violet accents, amber highlights.
 * Token NAMES preserved for backward compatibility.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas:           "#F0F2F5",
        surface:          "#FFFFFF",
        "surface-muted":  "#F5F6FA",
        "surface-raised": "#ECEEF4",
        burgundy: {
          50:   "#F3F0FF",
          100:  "#EAE4FF",
          200:  "#D4CAFF",
          300:  "#B8A5FF",
          400:  "#9B7EFF",
          500:  "#7C5CFA",
          600:  "#6941F0",
          700:  "#5630D4",
          800:  "#4321AC",
          900:  "#341A85",
          deep: "#240E66",
        },
        rosegold: {
          50:   "#FFF8EC",
          100:  "#FFEECB",
          200:  "#FFD98A",
          300:  "#FFC044",
          400:  "#FFA91A",
          500:  "#F59000",
          600:  "#D97006",
          700:  "#B45309",
          800:  "#923E0E",
          900:  "#78300F",
          sheen: "#F59000",
        },
        ink: {
          DEFAULT: "#1A1D2E",
          soft:    "#4A5068",
          faint:   "#8892A4",
        },
        line:  "#E2E5EE",
        viz: {
          indigo:  "#6941F0",
          teal:    "#0B9E8C",
          violet:  "#9B5DE5",
          sky:     "#0EA5E9",
          amber:   "#F59E0B",
          rose:    "#F43F5E",
          emerald: "#10B981",
          slate:   "#64748B",
        },
      },
      fontFamily: {
        serif: ["var(--font-jost)", "system-ui", "sans-serif"],
        sans:  ["var(--font-jost)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft:       "0 1px 3px 0 rgba(26,29,46,0.06), 0 1px 2px -1px rgba(26,29,46,0.04)",
        luxe:       "0 4px 16px -2px rgba(26,29,46,0.10), 0 2px 6px -2px rgba(26,29,46,0.06)",
        "luxe-lg":  "0 20px 48px -12px rgba(26,29,46,0.18)",
        glow:       "0 0 0 3px rgba(105,65,240,0.18)",
        "glow-gold":"0 0 20px rgba(245,144,0,0.22)",
        "brutal-sm":   "0 1px 2px 0 rgba(26,29,46,0.06)",
        "brutal-lime": "0 4px 12px -2px rgba(105,65,240,0.12)",
        "brutal-cyan": "0 4px 12px -2px rgba(11,158,140,0.12)",
      },
      backgroundImage: {
        "rosegold-sheen": "linear-gradient(135deg, #6941F0 0%, #9B5DE5 50%, #F59000 100%)",
        "burgundy-deep":  "linear-gradient(150deg, #5630D4 0%, #240E66 100%)",
        "sidebar-bg":     "linear-gradient(180deg, #1A1D2E 0%, #22263A 100%)",
        "card-glass":     "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(245,246,250,0.95) 100%)",
        "accent-glow":    "radial-gradient(ellipse at top, rgba(105,65,240,0.08) 0%, transparent 60%)",
        "gold-glow":      "radial-gradient(ellipse at bottom, rgba(245,144,0,0.08) 0%, transparent 60%)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(105,65,240,0.3)" },
          "50%":       { boxShadow: "0 0 20px rgba(105,65,240,0.6)" },
        },
      },
      animation: {
        "fade-up":    "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        shimmer:      "shimmer 3s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
