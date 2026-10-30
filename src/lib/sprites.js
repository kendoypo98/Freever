// One glyph registry for the whole app: UI icons, theme sprites, CSS badges and the animated backgrounds.
// 24x24 grid. Stroke glyphs are drawn with a 2px round stroke, the others are filled (even-odd, so holes are real cut-outs).
// Everything is a single colour (currentColor in the DOM) so a theme can tint it; no emoji anywhere.
const s = (d) => ({ d, stroke: true });
const f = (d) => ({ d });

export const GLYPHS = {
  // interface icons
  upload: s('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12'),
  user: s('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'),
  users: s('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75'),
  calendar: s('M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'),
  message: s('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'),
  sliders: s('M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6'),
  sun: s('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41'),
  moon: s('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'),
  check: s('M20 6L9 17l-5-5'),
  copy: s('M9 9h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'),
  refresh: s('M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15'),
  left: s('M19 12H5 M12 19l-7-7 7-7'),
  right: s('M5 12h14 M12 5l7 7-7 7'),
  x: s('M18 6L6 18 M6 6l12 12'),
  alert: s('M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01'),
  sparkles: s('M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 3v4 M21 5h-4'),
  logout: s('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9'),
  clock: s('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2'),
  trash: s('M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'),
  image: s('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z M21 15l-5-5L5 21'),
  lock: s('M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4'),
  swap: s('M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3'),
  eye: s('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'),
  eyeoff: s('M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19 M1 1l22 22 M14.12 14.12a3 3 0 1 1-4.24-4.24'),
  shield: s('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
  home: s('M3 11l9-8 9 8 M5 10v10h5v-6h4v6h5V10'),
  inbox: s('M22 12h-6l-2 3h-4l-2-3H2 M5.450 5.110L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.450-6.890A2 2 0 0 0 16.760 4H7.240a2 2 0 0 0-1.790 1.110z'),
  grid: s('M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'),
  // theme sprites
  snowflake: s('M12 2v20 M3.340 7l17.320 10 M3.340 17l17.320-10 M9 4l3 2.500L15 4 M9 20l3-2.500 3 2.500'),
  spider: s('M12 10.800a3.200 3.200 0 1 0 0 6.400 3.200 3.200 0 1 0 0-6.400z M12 7.600a1.600 1.600 0 1 0 0 3.200 1.600 1.600 0 1 0 0-3.200z M9.500 11.500L7 7.500 4 6.500 M8.800 13.200L4.500 11.500 2.500 13 M8.800 15L4.500 16.500 3 19.500 M9.800 16.800L7.500 20 5.500 21.500 M14.5 11.500L17.0 7.500 20.0 6.500 M15.2 13.200L19.5 11.500 21.5 13 M15.2 15L19.5 16.500 21.0 19.500 M14.2 16.800L16.5 20 18.5 21.500'),
  envelope: s('M3 6h18v12H3z M3 6.500l9 7 9-7'),
  slash: s('M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M5.600 5.600l12.800 12.800'),
  heart: f('M12 21C5.500 16.400 3 12.800 3 9.400 3 6.900 4.900 5 7.300 5c1.900 0 3.700 1.100 4.700 2.900C13 6.100 14.800 5 16.700 5 19.100 5 21 6.900 21 9.400c0 3.400-2.500 7-9 11.600z'),
  star: f('M12 2.500l2.900 6.200 6.600.8-4.900 4.600 1.300 6.700L12 17.600l-5.900 3.200 1.300-6.700L2.500 9.500l6.600-.8z'),
  sparkle: f('M12 2c.6 5.200 2.800 8.400 8 10-5.200 1.600-7.400 4.800-8 10-.6-5.200-2.800-8.400-8-10 5.200-1.600 7.400-4.800 8-10z'),
  pumpkin: f('M12 6.500C9.800 5 6.500 5.200 4.800 7.600 3.200 9.800 3.200 13.800 5 16.400 6.500 18.600 9.200 19.600 12 19c2.800.6 5.500-.4 7-2.600 1.800-2.600 1.800-6.600.2-8.800C17.500 5.200 14.200 5 12 6.500z M10.800 2.800h2.400V6h-2.400z M7.800 11.200l1.700-2.400 1.700 2.400z M12.800 11.200l1.700-2.400 1.700 2.400z M8.600 14.200h6.800l-1.100 2.600-1.200-1.100-1.100 1.100-1.100-1.100-1.200 1.100z'),
  bat: f('M12 7.600 13.200 5.600 13.900 8.200 16.500 7.600 22.500 6.200 21.600 9.200 22 12.400 19.400 11 18.400 14.600 16 12.200 14.600 15.200 12.900 13.200 12 17.800 11.100 13.200 9.400 15.200 8 12.200 5.600 14.600 4.600 11 2 12.400 2.400 9.200 1.500 6.200 7.500 7.600 10.100 8.200 10.800 5.600z M10.600 9.500h.8v.9h-.8z M12.600 9.500h.8v.9h-.8z'),
  ghost: f('M12 3C8.100 3 5.500 5.900 5.500 9.600V20.500L8 18.300 10 20.500 12 18.300 14 20.500 16 18.300 18.500 20.500V9.600C18.500 5.900 15.900 3 12 3z M9 9.500a1.300 1.800 0 1 0 2.600 0 1.300 1.800 0 1 0-2.600 0z M12.400 9.500a1.300 1.800 0 1 0 2.600 0 1.300 1.800 0 1 0-2.600 0z M10.800 13.200a1.300 1.500 0 1 0 2.400 0 1.300 1.500 0 1 0-2.400 0z'),
  tree: f('M12 2l4.500 6h-2.500l3.800 5h-3.300l3.500 5.500H5.500L9 13H5.800L9.500 8H7.500z M10.800 18.800h2.400V22h-2.400z'),
  gift: f('M3.500 8h17v4h-17z M5 12.500h14V21H5z M11 8h2v13h-2z M12 8C9.500 8 8 6.800 8 5.500 8 4.300 9 3.500 10.200 3.500 11.200 3.500 12 6 12 8z M12 8c2.500 0 4-1.200 4-2.500 0-1.200-1-2-2.200-2-1 0-1.800 2.500-1.800 4.500z'),
  bell: f('M12 3a1.200 1.200 0 0 1 1.200 1.200v.7c2.400.6 4 2.700 4 5.300V15l1.800 2.500v.9H5v-.9L6.800 15v-4.800c0-2.600 1.600-4.700 4-5.300v-.7A1.200 1.200 0 0 1 12 3z M10 19.500h4a2 2 0 0 1-4 0z'),
  joystick: f('M12 2.500a3 3 0 1 0 0 6 3 3 0 1 0 0-6z M11 8h2v6h-2z M5 14h14a1.500 1.500 0 0 1 1.500 1.500V19a1.500 1.500 0 0 1-1.500 1.500H5A1.500 1.500 0 0 1 3.500 19v-3.500A1.500 1.500 0 0 1 5 14z M16.500 16a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 1 0 0-2.400z M6.500 16.800h5v1h-5z'),
  invader: f('M5 4h2v2h-2z M17 4h2v2h-2z M7 6h2v2h-2z M15 6h2v2h-2z M5 8h14v2h-14z M3 10h4v2h-4z M9 10h6v2h-6z M17 10h4v2h-4z M1 12h22v2h-22z M1 14h2v2h-2z M5 14h14v2h-14z M21 14h2v2h-2z M1 16h2v2h-2z M5 16h2v2h-2z M17 16h2v2h-2z M21 16h2v2h-2z M7 18h4v2h-4z M13 18h4v2h-4z'),
};

const svgOf = (g, color) => {
  const body = g.stroke
    ? `fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'`
    : `fill='${color}' fill-rule='evenodd'`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${g.d}' ${body}/></svg>`;
};

/**
 * CSS cannot draw an inline <svg> in ::before, so every glyph is also published as a custom property:
 * --sp-NAME is a mask image (tinted with background: currentColor), --spw-NAME is the same glyph in white.
 */
export function installSpriteVars(root = document.documentElement) {
  for (const [name, g] of Object.entries(GLYPHS)) {
    root.style.setProperty(`--sp-${name}`, `url("data:image/svg+xml,${encodeURIComponent(svgOf(g, '#000'))}")`);
    root.style.setProperty(`--spw-${name}`, `url("data:image/svg+xml,${encodeURIComponent(svgOf(g, '#fff'))}")`);
  }
}

const cache = new Map();
/** Canvas drawing: a glyph centred on (0,0), `size` px wide, in `color`. */
export function drawGlyph(ctx, name, size, color) {
  const g = GLYPHS[name];
  if (!g) return;
  if (!cache.has(name)) cache.set(name, new Path2D(g.d));
  ctx.save();
  ctx.translate(-size / 2, -size / 2);
  ctx.scale(size / 24, size / 24);
  if (g.stroke) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(cache.get(name)); }
  else { ctx.fillStyle = color; ctx.fill(cache.get(name), 'evenodd'); }
  ctx.restore();
}
