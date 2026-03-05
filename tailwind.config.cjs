/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#eef9ff',
                    100: '#d8f1ff',
                    200: '#b9e8ff',
                    300: '#89daff',
                    400: '#52c3ff',
                    500: '#2aa5ff',
                    600: '#1285f5',
                    700: '#0b6de1',
                    800: '#1057b6',
                    900: '#134c8e',
                    950: '#0e2f57',
                },
                green: {
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                },
                fuel: {
                    gas: '#6366f1',
                    diesel: '#f59e0b',
                    glp: '#10b981',
                    gnc: '#3b82f6',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            animation: {
                'fade-in': 'fadeIn 0.4s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-slow': 'pulse 3s infinite',
                'shimmer': 'shimmer 1.5s infinite',
            },
            keyframes: {
                fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
                slideUp: { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            backgroundImage: {
                'gradient-brand': 'linear-gradient(135deg, #10b981 0%, #2aa5ff 50%, #6366f1 100%)',
                'gradient-dark': 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            },
            boxShadow: {
                'glow-green': '0 0 20px rgba(16,185,129,0.3)',
                'glow-blue': '0 0 20px rgba(42,165,255,0.3)',
                'glow-indigo': '0 0 20px rgba(99,102,241,0.3)',
                'card': '0 4px 24px rgba(0,0,0,0.08)',
                'card-dark': '0 4px 24px rgba(0,0,0,0.4)',
            },
        },
    },
    plugins: [],
};
