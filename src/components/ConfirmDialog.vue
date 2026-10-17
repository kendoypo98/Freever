<script setup>
import { nextTick, ref, watch } from 'vue';
import { dialog, answer } from '../store.js';

const cancelBtn = ref(null);
const okBtn = ref(null);
let opener = null;

watch(() => dialog.open, async (open) => {
  if (open) {
    opener = document.activeElement;
    await nextTick();
    (dialog.danger ? cancelBtn : okBtn).value?.focus();
  } else if (opener?.focus) {
    opener.focus();
    opener = null;
  }
});

// keep Tab inside the two buttons
function trap(e) {
  if (e.key !== 'Tab') return;
  const first = cancelBtn.value;
  const last = okBtn.value;
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
</script>

<template>
  <template v-if="dialog.open">
    <div class="scrim" @click="answer(false)" />
    <div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text"
      @keydown.esc.stop="answer(false)" @keydown="trap">
      <h2 id="confirm-title">{{ dialog.title }}</h2>
      <p v-if="dialog.text" id="confirm-text" class="muted">{{ dialog.text }}</p>
      <div class="actions">
        <button ref="cancelBtn" type="button" @click="answer(false)">Cancel</button>
        <button ref="okBtn" type="button" :class="dialog.danger ? 'danger' : 'primary'" @click="answer(true)">{{ dialog.okLabel }}</button>
      </div>
    </div>
  </template>
</template>
