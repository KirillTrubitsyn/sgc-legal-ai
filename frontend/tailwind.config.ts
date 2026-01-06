import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sgc: {
          blue: {
            500: "#1e3a5f",
            700: "#0f2035",
            900: "#0a1520",
          },
          orange: {
            500: "#f7941d",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
