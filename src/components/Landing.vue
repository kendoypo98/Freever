<script setup>
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import { state, toggleLandingDark } from '../store.js';

const BASE = import.meta.env.BASE_URL;

const FEATURES = [
  { icon: 'upload', title: 'Import the schedule', text: 'The admin drops the S.A Excel file once. FreeVer reads the ITO Department sheet and keeps it for everyone.' },
  { icon: 'clock', title: 'Knows who is free', text: 'Yellow is duty, blue is class, white is non-working time. Only students on duty and out of class are suggested; white is never forced to work without the supervisor's approval.' },
  { icon: 'swap', title: 'Replaces automatically', text: 'Mark a reliever on leave or absent and the best free student assistant is picked for you.' },
  { icon: 'message', title: 'Messenger-ready', text: 'Get a clean, professional message with the dates, times and relievers. One click to copy.' },
];
const STEPS = [
  ['Log in', 'Use your Student ID or S.A name.'],
  ['Pick days', 'Choose the duty days you need covered.'],
  ['Review', 'Check the reliever for each time.'],
  ['Send', 'Copy the message to Messenger.'],
];

// the demo always shows the coming Monday instead of a fixed date
const nextMonday = (() => {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
})();
const demoShort = nextMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const demoLong = nextMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ---- interactive demo (made-up names only) ----
const SLOTS = [
  { time: '12:00 PM – 3:00 PM', pool: ['Student Assistant A', 'Student Assistant B', 'Student Assistant C'] },
  { time: '3:00 PM – 10:00 PM', pool: ['Student Assistant D', 'Student Assistant E', 'Student Assistant F'] },
];
const picks = ref(SLOTS.map(() => 0)); // index in the pool of the current reliever
const notes = ref(SLOTS.map(() => ''));
const message = ref(false);
const initial = (n) => n.split(' ').pop();

function mark(i, kind) {
  const next = picks.value[i] + 1;
  if (next >= SLOTS[i].pool.length) { notes.value[i] = 'Nobody else is free for this time.'; return; }
  notes.value[i] = `${SLOTS[i].pool[picks.value[i]]} is ${kind}. Replaced automatically with the best match.`;
  picks.value[i] = next;
}
function resetDemo() { picks.value = SLOTS.map(() => 0); notes.value = SLOTS.map(() => ''); }
const changed = computed(() => picks.value.some((p) => p > 0));

// ---- fade-in when scrolled into view (skipped for people who prefer less motion) ----
const vReveal = {
  mounted(el, { value: delay = 0 }) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    el.classList.add('opacity-0', 'translate-y-6');
    el.style.transitionDelay = `${delay}ms`;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      el.classList.remove('opacity-0', 'translate-y-6');
      io.disconnect();
    }, { threshold: 0.15 });
    io.observe(el);
  },
};
</script>

<template>
  <div class="land overflow-x-clip">
    <header class="land-nav">
      <div class="brand">
        <img :src="`${BASE}favicon.svg`" alt="" width="32" height="32" />
        <span class="wordmark">Free<span>Ver</span></span>
      </div>
      <div class="land-nav-right">
        <button class="icon-btn" aria-label="Toggle dark mode" @click="toggleLandingDark">
          <Icon :name="state.darkPre ? 'sun' : 'moon'" />
        </button>
        <button class="ghost whitespace-nowrap" @click="state.view = 'login'">Log in</button>
        <button class="primary whitespace-nowrap !px-3 sm:!px-[.95rem]" @click="state.view = 'register'">Get started</button>
      </div>
    </header>

    <section class="hero relative">
      <!-- soft moving glow behind the hero -->
      <div class="pointer-events-none absolute -top-10 right-0 -z-10 size-72 animate-pulse rounded-full bg-[var(--accent)]/20 blur-3xl motion-reduce:animate-none" />

      <div class="hero-copy transition-all duration-700">
        <span class="eyebrow">Student Assistant reliever system</span>
        <h1 class="quote" lang="tl">Kapag may kailangan ka, <em>mag pareliever ka.</em></h1>
        <p class="muted small -mt-2">Whenever you need cover, ask for a reliever.</p>
        <p class="lead">
          FreeVer finds a fellow Student Assistant who is actually free, builds the reliever list for your duty days,
          and writes the message you send on Messenger.
        </p>
        <div class="hero-cta">
          <button class="primary lg w-full transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:w-auto" @click="state.view = 'register'">
            Create free account <Icon name="right" :size="16" />
          </button>
          <button class="lg w-full transition hover:-translate-y-0.5 active:translate-y-0 sm:w-auto" @click="state.view = 'login'">I have an account</button>
        </div>
        <ul class="hero-points">
          <li><Icon name="check" :size="16" /> Free to use</li>
          <li><Icon name="check" :size="16" /> Reads your Excel schedule</li>
          <li><Icon name="check" :size="16" /> Other students' names are never shown</li>
        </ul>
      </div>

      <!-- try it: the same automatic replacement the real app does -->
      <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl transition-transform duration-500 hover:-rotate-1 hover:scale-[1.01]">
        <div class="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div class="flex gap-1.5"><i class="size-2.5 rounded-full bg-red-400" /><i class="size-2.5 rounded-full bg-amber-400" /><i class="size-2.5 rounded-full bg-emerald-400" /></div>
          <span class="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">Try it: press Leave</span>
        </div>

        <div class="grid gap-3 p-4">
          <div class="flex items-baseline justify-between text-sm font-bold">Monday <span class="font-normal text-[var(--muted)]">{{ demoShort }}</span></div>

          <div v-for="(slot, i) in SLOTS" :key="slot.time" class="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span class="tag duty !m-0">{{ slot.time }}</span>
              <Transition mode="out-in" enter-active-class="transition duration-300" enter-from-class="opacity-0 translate-x-3"
                leave-active-class="transition duration-150" leave-to-class="opacity-0 -translate-x-3">
                <div :key="picks[i]" class="flex min-w-[10rem] flex-1 items-center gap-2.5">
                  <span class="grid size-9 place-items-center rounded-full bg-[var(--accent)]/12 text-sm font-bold text-[var(--accent)]">{{ initial(slot.pool[picks[i]]) }}</span>
                  <div class="leading-tight">
                    <b class="text-sm">{{ slot.pool[picks[i]] }}</b>
                    <div class="text-xs font-semibold text-[var(--ok)]">Free the whole time</div>
                  </div>
                </div>
              </Transition>
              <div class="ml-auto flex overflow-hidden rounded-lg border border-[var(--border)] text-xs font-semibold">
                <span class="bg-[var(--ok)] px-2.5 py-1.5 text-white">Available</span>
                <button class="!rounded-none !border-0 !border-l !border-[var(--border)] !px-2.5 !py-1.5 !text-xs !shadow-none hover:!bg-amber-100 hover:!text-amber-800" @click="mark(i, 'on leave')">Leave</button>
                <button class="!rounded-none !border-0 !border-l !border-[var(--border)] !px-2.5 !py-1.5 !text-xs !shadow-none hover:!bg-red-100 hover:!text-red-800" @click="mark(i, 'absent')">Absent</button>
              </div>
            </div>
            <Transition enter-active-class="transition duration-300" enter-from-class="opacity-0 -translate-y-1">
              <p v-if="notes[i]" class="mt-2 flex items-start gap-1.5 rounded-lg bg-[var(--accent)]/8 px-2.5 py-1.5 text-xs text-[var(--accent)]">
                <Icon name="sparkles" :size="13" class="mt-0.5" /> {{ notes[i] }}
              </p>
            </Transition>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button class="!px-3 !py-1.5 !text-xs" @click="message = !message">
              <Icon name="message" :size="14" /> {{ message ? 'Hide message' : 'Preview message' }}
            </button>
            <button v-if="changed" class="link !text-xs" @click="resetDemo">Reset demo</button>
          </div>
          <Transition enter-active-class="transition duration-300" enter-from-class="opacity-0 -translate-y-1">
            <pre v-if="message" class="whitespace-pre-wrap rounded-xl border border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3 font-[inherit] text-xs leading-relaxed text-[var(--muted)]">Good day! I would like to request a reliever for my scheduled duty:

Monday ({{ demoLong }})
• {{ SLOTS[0].time }} — Reliever: {{ SLOTS[0].pool[picks[0]] }}
• {{ SLOTS[1].time }} — Reliever: {{ SLOTS[1].pool[picks[1]] }}</pre>
          </Transition>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 v-reveal class="section-title transition-all duration-700">Everything you need to find a reliever</h2>
      <p v-reveal class="section-sub transition-all duration-700">Built around the way S.A schedules really work.</p>
      <div class="features">
        <article v-for="(f, i) in FEATURES" :key="f.title" v-reveal="i * 100"
          class="feature group transition-all duration-700 hover:-translate-y-1.5 hover:border-[var(--accent)]/50 hover:shadow-xl">
          <span class="badge-icon transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"><Icon :name="f.icon" /></span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>
    </section>

    <section class="section alt">
      <h2 v-reveal class="section-title transition-all duration-700">How it works</h2>
      <ol class="how">
        <li v-for="(s, i) in STEPS" :key="s[0]" v-reveal="i * 120" class="group transition-all duration-700">
          <span class="num transition-transform duration-300 group-hover:scale-110">{{ i + 1 }}</span><b>{{ s[0] }}</b><p>{{ s[1] }}</p>
        </li>
      </ol>
      <div v-reveal class="legend-row transition-all duration-700">
        <span class="tag duty">Yellow &middot; Duty</span>
        <span class="tag class">Blue &middot; Class</span>
        <span class="tag free">White &middot; Free</span>
      </div>
    </section>

    <section v-reveal class="cta-band transition-all duration-700">
      <h2>Need someone to cover your duty?</h2>
      <button class="primary lg transition hover:-translate-y-0.5 hover:shadow-lg" @click="state.view = 'register'">
        Get started <Icon name="right" :size="16" />
      </button>
    </section>

    <footer class="land-foot">&copy; {{ new Date().getFullYear() }} FreeVer &middot; Student Assistant reliever</footer>
  </div>
</template>
