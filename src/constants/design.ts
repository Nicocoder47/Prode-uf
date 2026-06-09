// PRODEMUNDIAL 2026 — Premium V3 visual system (stadium night, glass, EA Sports feel)
export const WC26 = {
  // Stadium night greens
  night950: '#021d13',
  night900: '#053820',
  night800: '#0b6b38',
  green950: '#021d13',
  green900: '#053820',
  green800: '#0b6b38',
  green700: '#0d7a42',
  green600: '#12a058',
  green500: '#1FA971',
  green400: '#34C759',
  // FIFA accents
  fifaBlue: '#0057B8',
  fifaRed: '#EF233C',
  fifaYellow: '#F7C600',
  blue700: '#004B9B',
  blue600: '#0057B8',
  blue500: '#2D7FF9',
  red600: '#C92A36',
  red500: '#EF233C',
  orange500: '#FF6B3D',
  yellow500: '#F7C600',
  gold500: '#D4AF37',
  cream: '#F4F6F8',
  cream2: '#FFFFFF',
  white: '#FFFFFF',
  gray100: '#F1F3F5',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  muted: '#6B7280',
  text: '#0B1220',

  greenDark: '#021d13',
  green: '#0b6b38',
  greenLight: '#12a058',
  greenMid: '#1FA971',
  greenBright: '#34C759',
  blue: '#0057B8',
  blueMid: '#004B9B',
  blueBright: '#2D7FF9',
  blueLight: '#2D7FF9',
  yellow: '#F7C600',
  gold: '#D4AF37',
  yellowBright: '#FFD447',
  orange: '#FF6B3D',
  orangeMid: '#FF8C42',
  red: '#EF233C',
  redBright: '#EF233C',
  gray50: '#F4F6F8',
  gray300: '#E5E7EB',
  teal: '#1FA971',
  lightBlue: '#2D7FF9',
  dark: '#0B1220',
} as const;

export const COLORS = {
  ...WC26,
  primary: WC26.blue600,
  accent: WC26.green800,
  // Legacy aliases (components pre-V3)
  secondary: WC26.blue600,
  cardDark: WC26.night950,
  lightGray: WC26.gray100,
  darkGray: WC26.muted,
  trophy: WC26.fifaYellow,
} as const;

export const GRADIENTS = {
  stadiumNight: `linear-gradient(165deg, ${WC26.night950} 0%, ${WC26.night900} 42%, ${WC26.night800} 100%)`,
  hero: `radial-gradient(circle at 12% 0%, rgba(0,87,184,0.35), transparent 42%), radial-gradient(circle at 88% 8%, rgba(239,35,60,0.28), transparent 38%), radial-gradient(circle at 50% 100%, rgba(247,198,0,0.18), transparent 50%), linear-gradient(155deg, ${WC26.night950}, ${WC26.night900} 45%, ${WC26.night800})`,
  playerCard: `linear-gradient(145deg, rgba(2,29,19,0.98) 0%, rgba(5,56,32,0.92) 55%, rgba(11,107,56,0.88) 100%)`,
  ratingGold: `linear-gradient(135deg, ${WC26.fifaYellow} 0%, ${WC26.gold500} 100%)`,
  ratingSilver: `linear-gradient(135deg, #E8EEF5 0%, #B8C4D4 100%)`,
  actionRed: `linear-gradient(180deg, ${WC26.red500} 0%, ${WC26.red600} 100%)`,
  actionBlue: `linear-gradient(180deg, ${WC26.blue500} 0%, ${WC26.blue600} 100%)`,
  glass: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.82))',
  stadium: `linear-gradient(165deg, ${WC26.night950} 0%, ${WC26.night800} 100%)`,
  gold: `linear-gradient(135deg, ${WC26.yellowBright} 0%, ${WC26.yellow500} 55%, ${WC26.orange500} 100%)`,
} as const;

export const TYPOGRAPHY = {
  fontFamily: {
    sans: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "ui-monospace, 'SFMono-Regular', monospace",
  },
  sizes: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem' },
  weights: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, black: 900 },
};

export const SPACING = { '2xs': '0.125rem', xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '2.5rem', '3xl': '3rem' };

export const SHADOWS = {
  xs: '0 2px 8px rgba(0,0,0,0.12)',
  sm: '0 8px 24px rgba(0,0,0,0.14)',
  md: '0 16px 40px rgba(0,0,0,0.18)',
  lg: '0 20px 60px rgba(0,0,0,0.20)',
  card: '0 20px 60px rgba(0,0,0,0.20)',
  cardHover: '0 28px 70px rgba(0,0,0,0.24)',
  nav: '0 -8px 40px rgba(0,0,0,0.28), 0 -2px 12px rgba(0,0,0,0.12)',
  glow: '0 0 0 1px rgba(247,198,0,0.25), 0 20px 50px rgba(247,198,0,0.15)',
  float: '0 24px 64px rgba(0,0,0,0.32)',
};

export const RADIUS = { sm: '0.75rem', md: '1rem', lg: '1.25rem', xl: '1.75rem', '2xl': '1.75rem', '3xl': '1.75rem', '4xl': '2rem', card: '28px', full: '9999px' };

export const MOTION = {
  enter: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  enterScale: { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.26 } },
  slideUp: { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.24 } },
  stagger: { initial: {}, animate: { transition: { staggerChildren: 0.05 } } },
  tap: { whileTap: { scale: 0.97 } },
  hover: { whileHover: { scale: 1.02 }, transition: { duration: 0.18 } },
} as const;

/** Bottom nav — Mundial Night tokens (CSS :root --pm-nav-*) */
export const BOTTOM_NAV = {
  deep: '#041418',
  surface: '#0B1220',
  gold: '#F8B91E',
  goldDeep: '#D4AF37',
  white: '#F4F7FA',
  muted: 'rgba(244, 247, 250, 0.48)',
  accentGreen: '#1B7A43',
} as const;

/** Mundial Night — official palette for premium surfaces */
export const MUNDIAL_NIGHT = {
  bgDeep: '#041418',
  bgSurface: '#0B1220',
  gold: '#D4AF37',
  goldBright: '#F8B91E',
  text: '#F4F7FA',
  accentGreen: '#1B7A43',
} as const;

/** Fixture Game Center — Centro del Juego (/matches) */
export const FIXTURE_GAME_CENTER = {
  ...MUNDIAL_NIGHT,
  competitiveGreen: '#22C55E',
  groupBlue: '#1D4ED8',
  stadiumBg:
    'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(0,87,184,0.12), transparent 55%), linear-gradient(180deg, #041418 0%, #0B1220 100%)',
  glass: 'rgba(255, 255, 255, 0.04)',
  glassEdge: 'rgba(34, 197, 94, 0.18)',
  goldGradient: 'linear-gradient(90deg, #D4AF37 0%, #F8B91E 55%, #FFE08A 100%)',
  greenGradient: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
  greenPositive: '#22C55E',
  blueDepth: '#1D4ED8',
} as const;

/** Home Premium — Mundial Night surfaces (Fase 2) */
export const HOME_PREMIUM = {
  ...MUNDIAL_NIGHT,
  heroGradient:
    'radial-gradient(circle at 14% 0%, rgba(248,185,30,0.22), transparent 42%), radial-gradient(circle at 88% 12%, rgba(0,87,184,0.28), transparent 38%), linear-gradient(165deg, #041418 0%, #0B1220 52%, #0f1a2e 100%)',
  sheetBg: 'transparent',
  sheetEdge: 'rgba(212, 175, 55, 0.14)',
} as const;

/** Mundial En Vivo — home carousel (cache 30 min) */
export const LIVE_INSIGHTS = {
  ...MUNDIAL_NIGHT,
  competitiveGreen: '#22C55E',
  glass: 'rgba(255, 255, 255, 0.04)',
  glassEdge: 'rgba(34, 197, 94, 0.16)',
  goldBright: '#F8B91E',
} as const;

/** Assets estáticos en /public */
export const WC26_ASSETS = {
  copita: '/copita.png',
  fondoVertical: '/fondo%20vertical.png',
  fondoNav: '/fondo%20nav.png',
  fondoJugar: '/fondo-jugar.png',
} as const;

export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 };
