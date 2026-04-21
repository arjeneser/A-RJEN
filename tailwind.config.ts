import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          sky: "#0EA5E9",
          navy: "#1E3A8A",
          gold: "#F59E0B",
          "gold-dark": "#D97706",
        },
        // Backgrounds
        bg: {
          primary: "#070918",
          secondary: "#0F1228",
          card: "rgba(255,255,255,0.04)",
        },
        // Surfaces
        surface: {
          DEFAULT: "#161A35",
          2: "#1E2348",
        },
        airjen: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e3a8a",
          900: "#0a0e27",
          950: "#070918",
        },
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, #070918 0%, #0F1228 50%, #070918 100%)",
        "sky-gradient":
          "linear-gradient(180deg, #0C1445 0%, #1E3A8A 50%, #0369A1 100%)",
        "gold-gradient":
          "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
        "button-gradient":
          "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
        "card-gradient":
          "linear-gradient(135deg, #1E2348 0%, #161A35 100%)",
        "success-gradient":
          "linear-gradient(135deg, #065F46 0%, #047857 100%)",
        "boarding-gradient":
          "linear-gradient(135deg, #0F1228 0%, #1E2348 100%)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        "sky-glow": "0 0 40px rgba(14,165,233,0.20)",
        "gold-glow": "0 0 40px rgba(245,158,11,0.20)",
        "navy-glow": "0 0 60px rgba(30,58,138,0.30)",
        "card-dark":
          "0 4px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.05)",
        "card-hover":
          "0 8px 40px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
        "boarding-pass":
          "0 24px 80px rgba(0,0,0,0.60), 0 8px 32px rgba(14,165,233,0.08)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      animation: {
        "fade-up":        "fadeUp 0.5s ease-out forwards",
        "fade-in":        "fadeIn 0.4s ease-out forwards",
        float:            "float 6s ease-in-out infinite",
        "pulse-slow":     "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "spin-slow":      "spin 8s linear infinite",
        shimmer:          "shimmer 2s linear infinite",
        "plane-fly":      "planeFly 3s ease-in-out infinite",
        // ── New ──────────────────────────────────────────────────────────────
        /** Physical screen shake — driven by framer-motion variants; this CSS
         *  fallback is for non-motion contexts (e.g. reduced-motion disabled). */
        shake:            "shake 0.65s ease-in-out",
        /** Sweeping gold shimmer for the Gold Passport overlay. */
        "gold-shimmer":   "goldShimmer 2.4s linear infinite",
        /** Slow glow pulse for the Gold Passport border. */
        "gold-glow-pulse":"goldGlowPulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        planeFly: {
          "0%":   { transform: "translate(-4px,  4px) rotate(-5deg)" },
          "50%":  { transform: "translate( 4px, -4px) rotate( 5deg)" },
          "100%": { transform: "translate(-4px,  4px) rotate(-5deg)" },
        },
        // ── New ──────────────────────────────────────────────────────────────
        /**
         * CSS shake fallback.  The real shake is handled by the framer-motion
         * `shakeVariants` exported from useTurbulenceMode — this mirrors that
         * oscillation pattern so the visual result is identical.
         */
        shake: {
          "0%,100%": { transform: "translate(0,0) rotate(0deg)" },
          "10%":     { transform: "translate(-10px,-2px) rotate(-1deg)" },
          "20%":     { transform: "translate( 10px, 2px) rotate( 1deg)" },
          "30%":     { transform: "translate(-8px, -2px) rotate(-0.8deg)" },
          "40%":     { transform: "translate(  8px, 1px) rotate( 0.8deg)" },
          "50%":     { transform: "translate(-6px, -1px) rotate(-0.5deg)" },
          "60%":     { transform: "translate(  6px, 1px) rotate( 0.5deg)" },
          "70%":     { transform: "translate(-4px,  0px) rotate(-0.3deg)" },
          "80%":     { transform: "translate(  4px, 0px) rotate( 0.3deg)" },
          "90%":     { transform: "translate(-2px,  0px) rotate(-0.1deg)" },
        },
        /** Horizontal shimmer sweep — used by GoldPassportOverlay */
        goldShimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        /** Soft glow pulse on the gold border */
        goldGlowPulse: {
          "0%,100%": {
            boxShadow:
              "0 0 20px rgba(245,158,11,0.15), 0 0 60px rgba(245,158,11,0.06)",
          },
          "50%": {
            boxShadow:
              "0 0 40px rgba(245,158,11,0.30), 0 0 100px rgba(245,158,11,0.12)",
          },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
