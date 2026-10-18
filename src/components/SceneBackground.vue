<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { state } from '../store.js';

// An animated seasonal / arcade background drawn on one canvas behind the whole app.
// It stands still for people who prefer reduced motion and stops when the tab is hidden.
const scene = computed(() => (state.profile ? state.prefs.scene || '' : ''));
const canvas = ref(null);

const PIXEL_COLORS = ['#22d3ee', '#f472b6', '#facc15', '#4ade80', '#a78bfa'];
const CONFIG = {
  valentine: { n: 26, kind: 'glyph', glyphs: ['❤️', '💖', '💗', '💕', '💘'], vy: [-48, -20], vx: [-8, 8], size: [18, 36], sway: 26 },
  halloween: { n: 22, kind: 'glyph', glyphs: ['🎃', '🦇', '👻', '🦇', '🕷️'], vy: [-8, 8], vx: [-46, 46], size: [22, 40], sway: 18 },
  christmas: { n: 110, kind: 'snow', glyphs: ['❄️', '⭐', '🎄', '🎁', '🔔', '🎅', '🦌', '❄️'], vy: [26, 70], vx: [-12, 12], size: [1.5, 4.5], sway: 14, glyphChance: 0.14 },
  pixel: { n: 70, kind: 'pixel', vy: [30, 95], vx: [0, 0], size: [4, 10], sway: 0 },
};

let raf = 0;
let ctx = null;
let parts = [];
let w = 0;
let h = 0;
let dpr = 1;
let last = 0;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function spawn(cfg, initial) {
  const p = {
    x: rand(0, w), y: initial ? rand(0, h) : (cfg.vy[1] < 0 ? h + 40 : -40),
    vx: rand(...cfg.vx), vy: rand(...cfg.vy), size: rand(...cfg.size),
    rot: rand(-0.4, 0.4), vr: rand(-0.5, 0.5), phase: rand(0, 6.28), freq: rand(0.6, 1.6),
    glyph: cfg.glyphs ? pick(cfg.glyphs) : '', color: pick(PIXEL_COLORS),
  };
  if (cfg.kind === 'snow' && Math.random() < (cfg.glyphChance || 0.07)) p.big = true; // some ornaments among the snow dots
  return p;
}

function draw(cfg, t) {
  ctx.clearRect(0, 0, w, h);
  for (const p of parts) {
    const swayX = cfg.sway ? Math.sin(t * p.freq + p.phase) * cfg.sway : 0;
    const x = p.x + swayX;
    if (cfg.kind === 'pixel') {
      const s = Math.round(p.size);
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 1.5 + p.phase));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(x / s) * s, Math.round(p.y / s) * s, s, s);
    } else if (cfg.kind === 'snow' && !p.big) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, p.y, p.size, 0, 6.2832);
      ctx.fill();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.translate(x, p.y);
      ctx.rotate(p.rot + Math.sin(t * p.freq + p.phase) * 0.25);
      ctx.font = `${p.big ? Math.round(p.size * 5 + 12) : p.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.glyph || '❄️', 0, 0);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function frame(now) {
  const cfg = CONFIG[scene.value];
  if (!cfg || !ctx) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (!document.hidden) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt * 0.2;
      if (p.y > h + 50 || p.y < -60 || p.x < -60 || p.x > w + 60) {
        // leave off one edge, come back on the opposite one
        const fresh = spawn(cfg, false);
        if (cfg.vy[1] < 0 || cfg.vy[0] > 0) parts[i] = fresh;
        else { p.x = p.x < 0 ? w + 50 : p.x > w ? -50 : p.x; p.y = p.y > h + 50 ? -50 : p.y < -60 ? h + 50 : p.y; }
      }
    }
    draw(cfg, now / 1000);
  }
  raf = requestAnimationFrame(frame);
}

function size() {
  if (!canvas.value) return;
  dpr = Math.min(window.innerWidth < 640 ? 1.5 : 2, window.devicePixelRatio || 1); // lighter on phones
  w = window.innerWidth; h = window.innerHeight;
  canvas.value.width = w * dpr; canvas.value.height = h * dpr;
  ctx = canvas.value.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

async function start() {
  cancelAnimationFrame(raf);
  await nextTick();
  const cfg = CONFIG[scene.value];
  if (!cfg || !canvas.value) return;
  size();
  const count = Math.round(cfg.n * (window.innerWidth < 640 ? 0.55 : 1)); // fewer pieces on phones: smoother, easier on the battery
  parts = Array.from({ length: count }, () => spawn(cfg, true));
  if (reduced()) { draw(cfg, 0); return; } // one still picture
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

watch(scene, start);
onMounted(() => { start(); window.addEventListener('resize', start); });
onBeforeUnmount(() => { cancelAnimationFrame(raf); window.removeEventListener('resize', start); });
</script>

<template>
  <div v-if="scene" class="scene" :data-scene="scene" aria-hidden="true">
    <canvas ref="canvas" />
  </div>
</template>
