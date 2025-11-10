import type { Config } from 'tailwindcss';

export default {
	darkMode: ['class'],
	content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				display: ['Oswald', 'system-ui', 'sans-serif'],
				oswald: ['Oswald', 'Impact', 'Arial Black', 'sans-serif'],
				heading: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
				mono: ['JetBrains Mono', 'Courier New', 'monospace']
			},
			colors: {
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				'accent-2': {
					DEFAULT: 'hsl(var(--accent-2))',
					foreground: 'hsl(var(--foreground))'
				},
				'accent-3': {
					DEFAULT: 'hsl(var(--accent-3))',
					foreground: 'hsl(var(--background))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				},
				// Neon brand colors from logo
				'neon-green': {
					DEFAULT: '#39FF14',
					light: '#5FFF47',
					dark: '#2DE000'
				},
				'electric-pink': '#FF006E',
				'electric-orange': '#FF6B35',
				'electric-red': '#FF0054',
				'electric-blue': {
					DEFAULT: '#00D9FF',
					dark: '#0066FF'
				},
				'electric-purple': '#9D4EDD',
				'deep-black': '#0A0A0A',
				metallic: {
					DEFAULT: '#E8E8E8',
					silver: '#C0C0C0',
					dark: '#A8A8A8'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			animation: {
				gradient: 'gradient 15s ease infinite',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'fade-in': 'fade-in 0.5s ease-out',
				'slide-up': 'slide-up 0.3s ease-out',
				'bounce-subtle': 'bounce-subtle 0.6s ease-out',
				shimmer: 'shimmer 2s infinite',
				'shimmer-slow': 'shimmer 3s infinite',
				'scale-in': 'scale-in 0.2s ease-out',
				'glow-pulse': 'glow-pulse 2s ease-in-out infinite'
			},
			keyframes: {
				'fade-in': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'bounce-subtle': {
					'0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0,0,0)' },
					'40%, 43%': { transform: 'translate3d(0,-8px,0)' },
					'70%': { transform: 'translate3d(0,-4px,0)' },
					'90%': { transform: 'translate3d(0,-2px,0)' }
				},
				shimmer: {
					'0%': { backgroundPosition: '-1000px 0' },
					'100%': { backgroundPosition: '1000px 0' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'glow-pulse': {
					'0%, 100%': {
						boxShadow: '0 0 20px rgba(57, 255, 20, 0.3)',
						borderColor: 'rgba(57, 255, 20, 0.3)'
					},
					'50%': {
						boxShadow: '0 0 30px rgba(57, 255, 20, 0.6)',
						borderColor: 'rgba(57, 255, 20, 0.6)'
					}
				},
				gradient: {
					'0%, 100%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' }
				}
			},
			boxShadow: {
				glow: '0 0 20px hsl(var(--primary) / 0.3)',
				'glow-lg': '0 0 40px hsl(var(--primary) / 0.4)',
				'glow-accent': '0 0 20px hsl(var(--accent) / 0.3)',
				'neon-green': '0 0 20px rgba(57, 255, 20, 0.4), 0 0 40px rgba(57, 255, 20, 0.2)',
				'neon-green-lg': '0 0 30px rgba(57, 255, 20, 0.5), 0 0 60px rgba(57, 255, 20, 0.3)',
				'gradient-glow': '0 0 30px rgba(255, 0, 110, 0.3), 0 0 60px rgba(255, 107, 53, 0.2)'
			},
			backdropBlur: {
				xs: '2px'
			}
		}
	},
	plugins: []
} satisfies Config;
