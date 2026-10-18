export const PRESETS = [
  { id: 'ocean', name: 'Ocean', accent: '#2563eb', light: { bg: '#f1f5fb', surface: '#ffffff' }, dark: { bg: '#0b1220', surface: '#131c2e' } },
  { id: 'forest', name: 'Forest', accent: '#15803d', light: { bg: '#f1f8f3', surface: '#ffffff' }, dark: { bg: '#0a150e', surface: '#112019' } },
  { id: 'sunset', name: 'Sunset', accent: '#c2410c', light: { bg: '#fdf5ef', surface: '#ffffff' }, dark: { bg: '#18100b', surface: '#241913' } },
  { id: 'grape', name: 'Grape', accent: '#9333ea', light: { bg: '#f7f2fc', surface: '#ffffff' }, dark: { bg: '#130c1c', surface: '#1e1530' } },
  { id: 'rose', name: 'Rose', accent: '#e11d48', light: { bg: '#fdf2f4', surface: '#ffffff' }, dark: { bg: '#190b10', surface: '#26131a' } },
  { id: 'pixel', name: 'Pixel Quest', accent: '#d62839', style: 'pixel', light: { bg: '#fdf3d0', surface: '#fffdf5' }, dark: { bg: '#1a1033', surface: '#271a4a' } },
  { id: 'slate', name: 'Slate', accent: '#475569', light: { bg: '#f3f4f6', surface: '#ffffff' }, dark: { bg: '#0f1115', surface: '#181b21' } },
];

export const DEFAULT_PREFS = {
  mode: 'system', // system | light | dark
  preset: 'ocean',
  accent: '#2563eb',
  useCustomAccent: false,
  bgImage: '',
  bgDim: 0.55,
  fontSize: 16,
  use24: false,
  fun: true, // game style: chunky buttons, quest progress bar, confetti
  tpl: {},
};

export function applyTheme(prefs) {
  const root = document.documentElement;
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = prefs.mode === 'dark' || (prefs.mode === 'system' && sysDark);
  const preset = PRESETS.find((p) => p.id === prefs.preset) || PRESETS[0];
  const pal = dark ? preset.dark : preset.light;
  const accent = prefs.useCustomAccent ? prefs.accent : preset.accent;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.style = preset.style || '';
  root.dataset.fun = prefs.fun === false ? '' : '1';
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--bg', pal.bg);
  root.style.setProperty('--surface', pal.surface);
  root.style.setProperty('--bg-image', prefs.bgImage ? `url("${prefs.bgImage}")` : 'none');
  root.style.setProperty('--bg-dim', String(prefs.bgDim));
  root.style.setProperty('--font-size', `${prefs.fontSize}px`);
}

/** Resize an uploaded image so it fits comfortably in localStorage. */
export function imageToDataUrl(file, maxSide = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a valid image.')); };
    img.src = url;
  });
}
