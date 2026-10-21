import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ember: {
          DEFAULT: "#FF5B00",
          50: "#FFF3E8",
          200: "#FFC48A",
          300: "#FFA04D",
          400: "#FF7A1A",
          500: "#FF5B00",
          600: "#E04600",
          700: "#B33400",
          800: "#7A2200",
        },
        char: {
          DEFAULT: "#0B0908",
          800: "#141110",
          700: "#1E1A17",
          600: "#2A2420",
        },
        bone: "#F4EBDD",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-5%, -10%)" },
          "30%": { transform: "translate(3%, -15%)" },
          "50%": { transform: "translate(12%, 9%)" },
          "70%": { transform: "translate(9%, 4%)" },
          "90%": { transform: "translate(-1%, 7%)" },
        },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        grain: "grain 8s steps(10) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
