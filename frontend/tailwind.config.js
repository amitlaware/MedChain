/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.jsx",
    "./main.jsx",
    "./components/**/*.{js,jsx}",
    "./context/**/*.{js,jsx}",
    "./pages/**/*.{js,jsx}",
    "./services/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#effdfb",
          100: "#ccfbf3",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e"
        },
        ink: "#102033"
      },
      boxShadow: {
        soft: "0 16px 48px rgba(15, 35, 52, 0.08)"
      }
    }
  },
  plugins: []
};
