#!/usr/bin/env node
/**
 * Generates RECOMP's original audio cues as small WAV files in public/audio/.
 * Pure sine-tone beeps computed here at build time (no samples, no music,
 * no speech) — the app itself only plays these files with HTML <audio>.
 *
 * Usage: node scripts/generate-audio.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SAMPLE_RATE = 22_050;
const out = path.resolve(import.meta.dirname, "..", "public", "audio");

/** notes: [frequency Hz, duration ms, gap ms after] */
const CUES = {
  countdown: { gain: 0.45, notes: [[880, 110, 0]] },
  go: { gain: 0.5, notes: [[1320, 260, 0]] },
  tempo: { gain: 0.22, notes: [[660, 45, 0]] },
  rep: { gain: 0.3, notes: [[1046, 70, 0]] },
  transition: { gain: 0.42, notes: [[784, 150, 60], [1046, 220, 0]] },
  "rest-complete": { gain: 0.5, notes: [[990, 130, 90], [990, 130, 0]] },
  "workout-complete": { gain: 0.5, notes: [[660, 170, 40], [880, 170, 40], [1100, 320, 0]] },
};

function render({ gain, notes }) {
  const samples = [];
  const fade = Math.round(SAMPLE_RATE * 0.006); // 6 ms fade in/out avoids clicks
  for (const [freq, ms, gapMs] of notes) {
    const n = Math.round((SAMPLE_RATE * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / fade, (n - 1 - i) / fade);
      samples.push(Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * gain * env);
    }
    for (let i = 0; i < Math.round((SAMPLE_RATE * gapMs) / 1000); i++) samples.push(0);
  }
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

await mkdir(out, { recursive: true });
for (const [name, cue] of Object.entries(CUES)) {
  const file = path.join(out, `${name}.wav`);
  const bytes = wav(render(cue));
  await writeFile(file, bytes);
  console.log(`✓ public/audio/${name}.wav (${(bytes.length / 1024).toFixed(1)} KB)`);
}
