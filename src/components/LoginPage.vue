<script setup>
import { ref, computed, onMounted } from 'vue';
import Icon from './Icon.vue';
import FloatField from './FloatField.vue';
import { login, register, needsSetup } from '../lib/auth.js';
import { configured } from '../lib/supabase.js';
import { state, enter } from '../store.js';

const BASE = import.meta.env.BASE_URL;

const mode = ref(state.view === 'register' ? 'register' : 'login');
const isLogin = computed(() => mode.value === 'login');
const identifier = ref(''); // login: Student ID or S.A name
const studentId = ref('');
const saName = ref('');
const password = ref('');
const adminCode = ref('');
const firstAccount = ref(false); // no account exists yet: this one becomes the admin
onMounted(async () => { if (configured) firstAccount.value = await needsSetup(); });
const showPw = ref(false);
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const profile = isLogin.value
      ? await login(identifier.value, password.value)
      : await register(studentId.value, saName.value, password.value, adminCode.value);
    enter(profile);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

function setMode(m) {
  mode.value = m;
  error.value = '';
}
</script>

<template>
  <!-- the gradient fills the whole phone screen; on desktop the right half becomes a white form panel -->
  <div
    class="relative isolate flex min-h-dvh flex-col overflow-hidden lg:grid lg:grid-cols-[1.05fr_1fr]"
    style="background: linear-gradient(165deg, color-mix(in srgb, var(--accent) 92%, #000) 0%, color-mix(in srgb, var(--accent) 60%, #0b1220) 100%)"
  >
    <div class="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-white/15 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-32 -left-24 -z-10 size-80 rounded-full bg-cyan-300/20 blur-3xl" />

    <aside
      class="relative flex flex-col gap-6 px-6 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-white lg:justify-between lg:px-12 lg:py-10"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <img :src="`${BASE}favicon.svg`" alt="" width="36" height="36" class="rounded-lg" />
          <span class="text-xl font-extrabold tracking-tight">FreeVer</span>
        </div>
        <button
          class="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium text-white shadow-none hover:bg-white/20"
          @click="state.view = 'landing'"
        >
          <Icon name="left" :size="14" /> Home
        </button>
      </div>

      <div>
        <p class="text-[1.65rem] font-extrabold leading-[1.15] tracking-tight sm:text-3xl lg:text-5xl">
          Kapag may kailangan ka, <span class="opacity-75">mag pareliever ka.</span>
        </p>
        <ul class="mt-6 hidden gap-3 text-[0.95rem] opacity-95 lg:grid">
          <li class="flex items-center gap-2.5"><Icon name="check" :size="16" /> Detects who is free from duty and class hours</li>
          <li class="flex items-center gap-2.5"><Icon name="check" :size="16" /> Replaces a reliever on leave automatically</li>
          <li class="flex items-center gap-2.5"><Icon name="check" :size="16" /> Messenger-ready message, one click to copy</li>
        </ul>
      </div>
      <small class="hidden opacity-70 lg:block">Student Assistant reliever system</small>
    </aside>

    <!-- form: a floating card centred in the rest of the screen on phones -->
    <main class="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 lg:bg-[var(--surface)] lg:px-10 lg:pt-0">
      <form
        class="w-full max-w-[26rem] rounded-[1.75rem] border border-white/20 bg-[var(--surface)] p-6 shadow-2xl shadow-black/30 sm:p-8 lg:border-0 lg:p-0 lg:shadow-none"
        @submit.prevent="submit"
      >
        <div class="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg)] p-1" role="tablist" aria-label="Log in or create an account"
          @keydown.left.prevent="setMode('login')" @keydown.right.prevent="setMode('register')">
          <button
            type="button" role="tab" :aria-selected="isLogin" :tabindex="isLogin ? 0 : -1"
            class="!h-10 !rounded-lg !border-0 !shadow-none"
            :class="isLogin ? '!bg-[var(--surface)] text-[var(--text)] !shadow' : 'bg-transparent text-[var(--muted)]'"
            @click="setMode('login')"
          >Log in</button>
          <button
            type="button" role="tab" :aria-selected="!isLogin" :tabindex="!isLogin ? 0 : -1"
            class="!h-10 !rounded-lg !border-0 !shadow-none"
            :class="!isLogin ? '!bg-[var(--surface)] text-[var(--text)] !shadow' : 'bg-transparent text-[var(--muted)]'"
            @click="setMode('register')"
          >Create account</button>
        </div>

        <h2 class="text-2xl font-bold tracking-tight">{{ isLogin ? 'Welcome back' : 'Join FreeVer' }}</h2>
        <p class="mb-5 mt-1 text-[var(--muted)]">
          {{ isLogin ? 'Log in to find your reliever.' : 'Use your Student ID and your S.A name from the schedule.' }}
        </p>

        <p v-if="!configured" class="notice err mb-4">
          <Icon name="alert" :size="16" /> The database is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.
        </p>

        <div class="grid gap-4">
          <FloatField v-if="isLogin" v-model="identifier" label="Student ID or S.A name" icon="user"
            placeholder="e.g. 2024-00123 or Juan Dela Cruz" autocomplete="username" enterkeyhint="next" :error="!!error" />

          <template v-else>
            <FloatField v-model="studentId" label="Student ID" icon="user" placeholder="e.g. 2024-00123"
              enterkeyhint="next" />
            <FloatField v-model="saName" label="S.A name" icon="users" placeholder="e.g. Juan Dela Cruz"
              autocomplete="name" enterkeyhint="next" hint="Type it as it is written in the schedule." />
            <FloatField v-if="firstAccount" v-model="adminCode" label="Admin setup code" icon="lock" type="password"
              autocomplete="off" enterkeyhint="next" hint="You are the first user, so this account becomes the admin. Use the setup code from your database setup." />
          </template>

          <FloatField v-model="password" label="Password" icon="lock" :type="showPw ? 'text' : 'password'"
            :placeholder="isLogin ? 'Your password' : 'At least 8 characters'"
            :autocomplete="isLogin ? 'current-password' : 'new-password'" :minlength="isLogin ? undefined : 8"
            enterkeyhint="go" :error="!!error && isLogin">
            <template #end>
              <button type="button" class="icon-btn !p-1.5" :aria-label="showPw ? 'Hide password' : 'Show password'" @click="showPw = !showPw">
                <Icon :name="showPw ? 'eyeoff' : 'eye'" :size="18" />
              </button>
            </template>
          </FloatField>
        </div>
        <p v-if="error" class="notice err mt-4" role="alert"><Icon name="alert" :size="16" /> {{ error }}</p>

        <button
          class="primary group mt-6 h-12 w-full rounded-xl text-base transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          :disabled="busy || !configured"
        >
          <svg v-if="busy" class="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          {{ busy ? 'Please wait' : isLogin ? 'Log in' : 'Create account' }}
          <Icon v-if="!busy" name="right" :size="18" class="transition-transform duration-300 group-hover:translate-x-1" />
        </button>

        <p class="mt-4 text-center text-sm text-[var(--muted)]">
          {{ isLogin ? 'New to FreeVer?' : 'Already have an account?' }}
          <button type="button" class="link !inline" @click="setMode(isLogin ? 'register' : 'login')">
            {{ isLogin ? 'Create an account' : 'Log in' }}
          </button>
        </p>
        <p v-if="isLogin" class="mt-1 text-center text-xs text-[var(--muted)]">Forgot your password? Ask the admin to reset it for you.</p>
      </form>
      <p class="text-center text-xs text-white/75 lg:hidden">Student Assistant reliever system &middot; your data stays private</p>
    </main>
  </div>
</template>
