import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#17141f',
        paper: '#f6f0e3',
        ember: '#c65d2e',
        brass: '#b8963b',
        pine: '#245c4a',
        rose: '#f0d7ce',
        danger: '#7f1d1d',
      },
      boxShadow: {
        panel: '0 25px 70px rgba(23, 20, 31, 0.14)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(23,20,31,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(23,20,31,0.07) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

export default config;
