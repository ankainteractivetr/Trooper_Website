/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#05060a',
        panel: 'rgba(10, 14, 22, 0.55)',
        trooper: {
          red: '#ff2d2d',
          glow: '#ff5a4d',
          cyan: '#3df0ff',
          amber: '#ffc24b',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Rajdhani', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        hud: '0 0 0 1px rgba(61,240,255,0.25), 0 0 40px rgba(255,45,45,0.18), inset 0 0 30px rgba(61,240,255,0.05)',
      },
      keyframes: {
        flicker: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.92' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        flicker: 'flicker 4s ease-in-out infinite',
        scan: 'scan 6s linear infinite',
        rise: 'rise 0.8s cubic-bezier(0.2,0.7,0.2,1) both',
      },
    },
  },
  plugins: [],
};
