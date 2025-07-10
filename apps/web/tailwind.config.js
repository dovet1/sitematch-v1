/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-sans)'],
  			serif: ['var(--font-serif)'],
  			mono: ['var(--font-mono)']
  		},
  		colors: {
  			border: 'var(--border)',
  			input: 'var(--input)',
  			ring: 'var(--ring)',
  			background: 'var(--background)',
  			foreground: 'var(--foreground)',
  			primary: {
  				50: 'var(--primary-50)',
  				100: 'var(--primary-100)',
  				200: 'var(--primary-200)',
  				300: 'var(--primary-300)',
  				400: 'var(--primary-400)',
  				500: 'var(--primary-500)',
  				600: 'var(--primary-600)',
  				700: 'var(--primary-700)',
  				800: 'var(--primary-800)',
  				900: 'var(--primary-900)',
  				950: 'var(--primary-950)',
  				DEFAULT: 'var(--primary)',
  				foreground: 'var(--primary-foreground)'
  			},
  			secondary: {
  				DEFAULT: 'var(--secondary)',
  				foreground: 'var(--secondary-foreground)'
  			},
  			destructive: {
  				DEFAULT: 'var(--destructive)',
  				foreground: 'var(--destructive-foreground)'
  			},
  			muted: {
  				DEFAULT: 'var(--muted)',
  				foreground: 'var(--muted-foreground)'
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'var(--accent-foreground)'
  			},
  			popover: {
  				DEFAULT: 'var(--popover)',
  				foreground: 'var(--popover-foreground)'
  			},
  			card: {
  				DEFAULT: 'var(--card)',
  				foreground: 'var(--card-foreground)'
  			},
  			success: 'var(--success)',
  			warning: 'var(--warning)',
  			error: 'var(--error)',
  			info: 'var(--info)'
  		},
  		borderRadius: {
  			sm: 'var(--radius-sm)',
  			md: 'var(--radius-md)',
  			lg: 'var(--radius-lg)',
  			xl: 'var(--radius-xl)',
  			DEFAULT: 'var(--radius)'
  		},
  		spacing: {
  			0: 'var(--space-0)',
  			1: 'var(--space-1)',
  			2: 'var(--space-2)',
  			3: 'var(--space-3)',
  			4: 'var(--space-4)',
  			5: 'var(--space-5)',
  			6: 'var(--space-6)',
  			8: 'var(--space-8)',
  			10: 'var(--space-10)',
  			12: 'var(--space-12)',
  			16: 'var(--space-16)',
  			20: 'var(--space-20)',
  			24: 'var(--space-24)'
  		},
  		boxShadow: {
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)'
  		},
  		fontSize: {
  			xs: 'var(--text-xs)',
  			sm: 'var(--text-sm)',
  			base: 'var(--text-base)',
  			lg: 'var(--text-lg)',
  			xl: 'var(--text-xl)',
  			'2xl': 'var(--text-2xl)',
  			'3xl': 'var(--text-3xl)',
  			'4xl': 'var(--text-4xl)'
  		},
  		fontWeight: {
  			light: 'var(--font-weight-light)',
  			normal: 'var(--font-weight-normal)',
  			medium: 'var(--font-weight-medium)',
  			semibold: 'var(--font-weight-semibold)',
  			bold: 'var(--font-weight-bold)',
  			extrabold: 'var(--font-weight-extrabold)'
  		},
  		lineHeight: {
  			none: 'var(--leading-none)',
  			tight: 'var(--leading-tight)',
  			snug: 'var(--leading-snug)',
  			normal: 'var(--leading-normal)',
  			relaxed: 'var(--leading-relaxed)',
  			loose: 'var(--leading-loose)'
  		},
  		letterSpacing: {
  			tighter: 'var(--tracking-tighter)',
  			tight: 'var(--tracking-tight)',
  			normal: 'var(--tracking-normal)',
  			wide: 'var(--tracking-wide)',
  			wider: 'var(--tracking-wider)',
  			widest: 'var(--tracking-widest)'
  		},
  		zIndex: {
  			dropdown: 'var(--z-dropdown)',
  			sticky: 'var(--z-sticky)',
  			fixed: 'var(--z-fixed)',
  			'modal-backdrop': 'var(--z-modal-backdrop)',
  			modal: 'var(--z-modal)',
  			popover: 'var(--z-popover)',
  			tooltip: 'var(--z-tooltip)',
  			toast: 'var(--z-toast)',
  			60: '60',
  			50: '50',
  			40: '40',
  			30: '30',
  			20: '20',
  			10: '10'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: 0
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: 0
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}