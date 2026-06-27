import type { TenantTheme } from '@/types';

/** Convierte "#1a2b3c" → "26 43 60" (canales RGB para Tailwind + alpha). */
function hexToRgbChannels(hex: string): string {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const COLOR_KEYS: (keyof TenantTheme)[] = [
  'primary',
  'secondary',
  'accent',
  'surface',
  'background',
  'foreground',
  'muted',
  'border',
];

/** Inyecta el tema del tenant como CSS variables en :root. Única fuente de estética. */
export function applyTheme(theme: TenantTheme): void {
  const root = document.documentElement;
  for (const key of COLOR_KEYS) {
    const value = theme[key];
    if (value) root.style.setProperty(`--color-${key}`, hexToRgbChannels(value));
  }
  if (theme.font) root.style.setProperty('--font-family', theme.font);
  if (theme.radius) root.style.setProperty('--radius', theme.radius);
}
