import type { Config } from "tailwindcss";

/**
 * BELT-KIT luxury theme — Burgundy & Rose Gold on blush-ivory.
 * Light backgrounds only (per requirement). Deep wine burgundy as the
 * primary, warm rose-gold as the metallic accent, on soft ivory canvases.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds — light, neutral, professional
        canvas: "#F7F6F4", // soft warm-gray page background
        surface: "#FFFFFF", // card surface
        "surface-muted": "#F1EFEC", // subtle panel / hover

        // Burgundy (primary) scale
        burgundy: {
          50: "#FBEEF1",
          100: "#F3D3DB",
          200: "#E3A7B7",
          300: "#CE7189",
          400: "#A8455F",
          500: "#822742", // core
          600: "#6E1E3A",
          700: "#57162D",
          800: "#3F0F21",
          900: "#2A0A16",
        },

        // Rose gold (metallic accent) scale
        rosegold: {
          50: "#FBF1EF",
          100: "#F6E0DB",
          200: "#EDC3BB",
          300: "#E0A398",
          400: "#CF8577",
          500: "#B76E79", // core rose gold
          600: "#9E5A64",
          700: "#7E4650",
          800: "#5D343B",
          900: "#3E2327",
        },

        // Neutral ink for text
        ink: {
          DEFAULT: "#1C1A1B",
          soft: "#5C5559",
          faint: "#938C8F",
        },
        line: "#E7E3DF", // neutral hairline borders
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-jost)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        luxe: "0 10px 40px -12px rgba(110, 30, 58, 0.18)",
        "luxe-lg": "0 24px 60px -16px rgba(110, 30, 58, 0.24)",
        soft: "0 2px 12px -4px rgba(43, 34, 38, 0.10)",
      },
      backgroundImage: {
        "rosegold-sheen":
          "linear-gradient(135deg, #B76E79 0%, #E0A398 45%, #C6A15B 100%)",
        "burgundy-deep":
          "linear-gradient(150deg, #6E1E3A 0%, #57162D 60%, #3F0F21 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
