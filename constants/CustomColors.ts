// ============================================================
// DESIGN TOKENS — Emperatriz Delivery (Uber-inspired)
// Palette: #111827 (Black) #FFFFFF (White) #E53935 (Red)
// ============================================================

const palette = {
  black: '#111827',
  white: '#FFFFFF',
  red: '#E53935',
} as const;

// Helper — adjust opacity (0..1)
const alpha = (hex: string, a: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// Helper — lighten by mixing with white
const lighten = (hex: string, amount: number): string => {
  const r1 = parseInt(hex.slice(1, 3), 16);
  const g1 = parseInt(hex.slice(3, 5), 16);
  const b1 = parseInt(hex.slice(5, 7), 16);
  const r2 = parseInt(palette.white.slice(1, 3), 16);
  const g2 = parseInt(palette.white.slice(3, 5), 16);
  const b2 = parseInt(palette.white.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Helper — darken by mixing with black
const darken = (hex: string, amount: number): string => {
  const r1 = parseInt(hex.slice(1, 3), 16);
  const g1 = parseInt(hex.slice(3, 5), 16);
  const b1 = parseInt(hex.slice(5, 7), 16);
  const r2 = parseInt(palette.black.slice(1, 3), 16);
  const g2 = parseInt(palette.black.slice(3, 5), 16);
  const b2 = parseInt(palette.black.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const CustomColors = {
  // ── Brand ──────────────────────────────────────────────────
  primary: palette.red,
  secondary: palette.red,
  tertiary: palette.white,
  quaternary: palette.black,
  neutral: palette.black,

  // ── Light variants ────────────────────────────────────────
  primaryLight: lighten(palette.red, 0.25),
  secondaryLight: lighten(palette.red, 0.25),
  tertiaryLight: lighten(palette.white, 0.15),
  quaternaryLight: lighten(palette.black, 0.25),
  neutralLight: lighten(palette.black, 0.25),

  // ── Dark variants ──────────────────────────────────────────
  primaryDark: darken(palette.red, 0.3),
  secondaryDark: darken(palette.red, 0.3),
  neutralDark: darken(palette.black, 0.15),

  // ── Text ───────────────────────────────────────────────────
  textDark: palette.black,
  textLight: palette.white,

  // ── Status ─────────────────────────────────────────────────
  success: '#16A34A',
  error: palette.red,
  warning: '#F59E0B',
  info: '#3B82F6',
  violet: '#8B5CF6',
  orange: '#F97316',
  teal: '#14B8A6',
  slate: '#94A3B8',

  // ── Backgrounds ────────────────────────────────────────────
  backgroundLight: palette.white,
  backgroundMedium: lighten(palette.black, 0.08),
  backgroundDark: lighten(palette.black, 0.04),
  backgroundDarkest: palette.black,

  // ── Surfaces ───────────────────────────────────────────────
  cardBackground: lighten(palette.black, 0.06),
  inputBackground: lighten(palette.black, 0.10),
  tabBarBackground: palette.black,

  // ── Borders & Dividers ─────────────────────────────────────
  border: lighten(palette.black, 0.15),
  divider: lighten(palette.black, 0.12),

  // ── Shadows & Overlays ─────────────────────────────────────
  shadow: alpha(palette.black, 0.4),
  overlay: alpha(palette.black, 0.6),

  // ── Semantic helpers ───────────────────────────────────────
  whatsapp: '#25D366',
  white: palette.white,
  black: palette.black,
  transparent: 'transparent',

  // ── Legacy palette references (kept for backward compat) ──
  cream: palette.white,
  coral: palette.red,
  navy: palette.black,
} as const;

// ============================================================
// Legacy aliases — kept for backward compat during migration
// ============================================================
export const Colors = {
  primary: CustomColors.primary,
  secondary: CustomColors.secondary,
  tertiary: CustomColors.tertiary,
  quaternary: CustomColors.quaternary,
  neutral: CustomColors.neutral,
  primaryLight: CustomColors.primaryLight,
  secondaryLight: CustomColors.secondaryLight,
  tertiaryLight: CustomColors.tertiaryLight,
  quaternaryLight: CustomColors.quaternaryLight,
  neutralLight: CustomColors.neutralLight,
  textDark: CustomColors.textDark,
  textLight: CustomColors.textLight,
  success: CustomColors.success,
  error: CustomColors.error,
  warning: CustomColors.warning,
  info: CustomColors.info,
  backgroundLight: CustomColors.backgroundLight,
  backgroundMedium: CustomColors.backgroundMedium,
  backgroundDark: CustomColors.backgroundDark,
  backgroundDarkest: CustomColors.backgroundDarkest,
  cardBackground: CustomColors.cardBackground,
  inputBackground: CustomColors.inputBackground,
  tabBarBackground: CustomColors.tabBarBackground,
  border: CustomColors.border,
  divider: CustomColors.divider,
  shadow: CustomColors.shadow,
};
