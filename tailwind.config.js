/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                'xs': '344px',
            },
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
            },
            keyframes: {
                slideInRight: {
                    '0%': {
                        transform: 'translateX(100%)',
                        opacity: '0',
                    },
                    '100%': {
                        transform: 'translateX(0)',
                        opacity: '1',
                    },
                },
            },
            animation: {
                'slideInRight': 'slideInRight 0.3s ease-out',
            },
        },
    },
    plugins: [],
}
