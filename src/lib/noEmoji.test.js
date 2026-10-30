import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Themes use the SVG glyphs in sprites.js. This fails the build if an emoji or dingbat sneaks back into the UI.
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(vue|js|css|html)$/.test(f) ? [p] : [];
});

describe('no emoji in the UI', () => {
  it('source files are emoji-free', () => {
    const bad = walk('src').filter((f) => !f.endsWith('noEmoji.test.js') && EMOJI.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
