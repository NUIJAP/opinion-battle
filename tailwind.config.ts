import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "battle-user": "#3b82f6",
        "battle-ai": "#ef4444",
      },
      animation: {
        "hp-change": "hpChange 0.5s ease-out",
        "score-pop": "scorePop 0.6s ease-out",
      },
      keyframes: {
        hpChange: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        scorePop: {
          "0%": { transform: "translateY(0) scale(0.5)", opacity: "0" },
          "50%": { transform: "translateY(-20px) scale(1.2)", opacity: "1" },
          "100%": { transform: "translateY(-40px) scale(1)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
