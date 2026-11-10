"use client";

import type { SoundCue } from "@/lib/engine/workout-engine";

/**
 * Plays RECOMP's local audio cues with plain HTML <audio> elements.
 * No Web Audio API, no speech synthesis, no remote files.
 *
 * Browsers only allow sound after a user gesture: call `unlock()` from a
 * click (e.g. "Begin workout"). If a file is missing or playback is blocked,
 * the workout simply continues silently.
 */
const FILES: Record<SoundCue, string> = {
  countdown: "/audio/countdown.wav",
  go: "/audio/go.wav",
  tempo: "/audio/tempo.wav",
  rep: "/audio/rep.wav",
  rest_complete: "/audio/rest-complete.wav",
  transition: "/audio/transition.wav",
  workout_complete: "/audio/workout-complete.wav",
};

export class AudioCues {
  private elements = new Map<SoundCue, HTMLAudioElement>();
  enabled: boolean;
  volume: number;

  constructor(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = clampVolume(volume);
  }

  private element(cue: SoundCue): HTMLAudioElement | null {
    if (typeof Audio === "undefined") return null;
    let el = this.elements.get(cue);
    if (!el) {
      el = new Audio(FILES[cue]);
      el.preload = "auto";
      this.elements.set(cue, el);
    }
    return el;
  }

  /** Prime every element during a user gesture (needed on iPhone). */
  unlock(): void {
    for (const cue of Object.keys(FILES) as SoundCue[]) {
      const el = this.element(cue);
      if (!el) continue;
      el.muted = true;
      el.play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
        })
        .catch(() => {
          el.muted = false;
        });
    }
  }

  play(cue: SoundCue): void {
    if (!this.enabled || this.volume === 0) return;
    const el = this.element(cue);
    if (!el) return;
    try {
      el.volume = this.volume;
      el.currentTime = 0;
      const playing = el.play();
      if (playing && typeof playing.catch === "function") {
        playing.catch(() => {
          // Blocked or missing file: stay silent, never break the workout.
        });
      }
    } catch {
      // Some browsers throw synchronously (e.g. media not ready): ignore.
    }
  }

  set(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = clampVolume(volume);
    for (const el of this.elements.values()) {
      if (!this.enabled || this.volume === 0) el.pause(); // turning sound off silences a cue mid-play
      else el.volume = this.volume;
    }
  }
}

function clampVolume(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
}
