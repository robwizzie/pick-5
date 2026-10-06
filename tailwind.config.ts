import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const hsl = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

export default {
	darkMode: ['class'],
	content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
	safelist: [
		// Odds badge colors are built from strings in oddsUtils
		'bg-blue-400',
		'bg-blue-300',
		'bg-yellow-400',
		'bg-orange-400',
		'bg-red-400',
		'text-white',
		'text-black'
	],
	theme: {
		container: {
			center: true,
			padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
			screens: { '2xl': '1280px' }
		},
		extend: {
			fontFamily: {
				sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
				display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
				// Legacy aliases — every heading face resolves to the display font
				oswald: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
				heading: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
				mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
			},
			colors: {
				background: hsl('background'),
				foreground: hsl('foreground'),
				card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
				popover: { DEFAULT: hsl('popover'), foreground: hsl('popover-foreground') },
				primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground') },
				secondary: { DEFAULT: hsl('secondary'), foreground: hsl('secondary-foreground') },
				muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
				accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
				'accent-2': { DEFAULT: hsl('accent-2'), foreground: hsl('foreground') },
				'accent-3': { DEFAULT: hsl('accent-3'), foreground: hsl('background') },
				destructive: { DEFAULT: hsl('destructive'), foreground: hsl('destructive-foreground') },
				success: { DEFAULT: hsl('success'), foreground: hsl('success-foreground') },
				warning: { DEFAULT: hsl('warning'), foreground: hsl('warning-foreground') },
				live: hsl('live'),
				border: hsl('border'),
				input: hsl('input'),
				ring: hsl('ring'),
				surface: {
					DEFAULT: hsl('surface'),
					raised: hsl('surface-raised')
				},
				chart: {
					'1': hsl('chart-1'),
					'2': hsl('chart-2'),
					'3': hsl('chart-3'),
					'4': hsl('chart-4'),
					'5': hsl('chart-5')
				},
				// Brand colors (from the logo), kept under their legacy names
				'neon-green': { DEFAULT: '#7CFF4F', light: '#A6FF85', dark: '#4FE01F' },
				'electric-pink': '#FF2E7E',
				'electric-orange': '#FF7A30',
				'electric-red': '#FF3D5A',
				'electric-blue': { DEFAULT: '#38D6FF', dark: '#2F6BFF' },
				'electric-purple': '#9D6BFF',
				'deep-black': '#06080D',
				metallic: { DEFAULT: '#E8ECF2', silver: '#C3CAD6', dark: '#9AA3B2' }
			},
			borderRadius: {
				xl: 'calc(var(--radius) + 4px)',
				'2xl': 'calc(var(--radius) + 8px)',
				'3xl': 'calc(var(--radius) + 16px)',
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 4px)',
				sm: 'calc(var(--radius) - 6px)'
			},
			backgroundImage: {
				'brand-gradient': 'linear-gradient(100deg, #7CFF4F 0%, #38D6FF 45%, #FF3D5A 80%, #FF7A30 100%)',
				'brand-cool': 'linear-gradient(135deg, #38D6FF 0%, #2F6BFF 100%)',
				'brand-hot': 'linear-gradient(135deg, #FF3D5A 0%, #FF7A30 100%)',
				'brand-win': 'linear-gradient(135deg, #7CFF4F 0%, #2DE0A0 100%)'
			},
			animation: {
				gradient: 'gradient 12s ease infinite',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'fade-in': 'fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
				'slide-up': 'slide-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
				'bounce-subtle': 'bounce-subtle 0.6s ease-out',
				shimmer: 'shimmer 2s linear infinite',
				'shimmer-slow': 'shimmer 3s linear infinite',
				'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
				'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
				float: 'float 8s ease-in-out infinite',
				'spin-slow': 'spin 18s linear infinite',
				marquee: 'marquee 40s linear infinite'
			},
			keyframes: {
				'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
				'slide-up': {
					'0%': { transform: 'translateY(16px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'bounce-subtle': {
					'0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0,0,0)' },
					'40%, 43%': { transform: 'translate3d(0,-8px,0)' },
					'70%': { transform: 'translate3d(0,-4px,0)' },
					'90%': { transform: 'translate3d(0,-2px,0)' }
				},
				shimmer: {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.96)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'glow-pulse': {
					'0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.0), 0 0 24px hsl(var(--primary) / 0.25)' },
					'50%': { boxShadow: '0 0 0 4px hsl(var(--primary) / 0.12), 0 0 40px hsl(var(--primary) / 0.45)' }
				},
				'pulse-glow': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
				gradient: {
					'0%, 100%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' }
				},
				float: {
					'0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
					'50%': { transform: 'translateY(-14px) rotate(2deg)' }
				},
				marquee: {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(-50%)' }
				}
			},
			boxShadow: {
				glow: '0 0 24px hsl(var(--primary) / 0.35)',
				'glow-lg': '0 0 48px hsl(var(--primary) / 0.45)',
				'glow-accent': '0 0 24px hsl(var(--accent) / 0.35)',
				'neon-green': '0 0 24px rgba(124, 255, 79, 0.35)',
				'neon-green-lg': '0 0 40px rgba(124, 255, 79, 0.45)',
				'gradient-glow': '0 10px 40px -10px rgba(255, 61, 90, 0.55), 0 10px 40px -10px rgba(56, 214, 255, 0.45)',
				card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.8)',
				'card-hover': '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 30px 60px -24px rgba(0,0,0,0.9)',
				'primary-glow': '0 8px 30px -8px hsl(var(--primary) / 0.6)'
			},
			backdropBlur: { xs: '2px' },
			transitionTimingFunction: {
				'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)'
			}
		}
	},
	plugins: [animate]
} satisfies Config;
