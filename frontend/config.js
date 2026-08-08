const API_BASE = "https://api.balicivicai.site";

tailwind.config = {
    theme: {
        extend: {
            colors: {
                primary: '#C94B4B', // Merah Bata (Brand)
                primaryHover: '#A43838',
                accentGreen: '#1B9C85',
                accentGreenSoft: '#E1F4EF',
                accentTeal: '#2C8FBB',
                accentTealSoft: '#E0F2FA',
                bgPage: '#FAFAFA',
                cardGrey: '#F8FAFC',
                textDark: '#1E293B',
                textSecondary: '#64748B',
                lightBorder: '#E2E8F0',
                severityHigh: '#EF4444',
                severityMed: '#F59E0B',
                severityLow: '#10B981',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'shimmer': 'shimmer 3s linear infinite',
                'shine': 'shine 1.5s infinite',
                'bar-grow': 'barGrow 1.5s ease-out forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'bounce-slow': 'bounce 2s infinite',
                'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
                'slide-in-top': 'slideInTop 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
                'slide-out-top': 'slideOutTop 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53) both',
                'slide-up': 'slideUp 0.5s ease-out forwards',
                'fade-in': 'fadeIn 0.5s ease-out forwards',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '200% center' },
                    '100%': { backgroundPosition: '-200% center' },
                },
                shine: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' }
                },
                barGrow: {
                    '0%': { width: '0%' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInTop: {
                    '0%': { transform: 'translate(-50%, -100%)', opacity: '0' },
                    '100%': { transform: 'translate(-50%, 0)', opacity: '1' }
                },
                slideOutTop: {
                    '0%': { transform: 'translate(-50%, 0)', opacity: '1' },
                    '100%': { transform: 'translate(-50%, -100%)', opacity: '0' }
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                }
            }
        }
    }
}
