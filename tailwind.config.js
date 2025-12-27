/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#0066CC", // JE BEBIDAS Blue
                    foreground: "#FFFFFF",
                },
                secondary: {
                    DEFAULT: "#1E293B", // Slate-800
                    foreground: "#FFFFFF",
                },
                background: "#F8FAFC", // Slate-50
                surface: "#FFFFFF",
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
