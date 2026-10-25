"use client";

import type { Language } from "./types";

export interface SpeakItem {
  /** Bundled clip (preferred). */
  clip?: string;
  /** Spoken by the browser if the clip can't play. */
  text: string;
  lang: Language;
}

export interface SpeakerState {
  playing: boolean;
  /** Caller-chosen id of what is playing (e.g. "word-2"), for highlighting. */
  key: string | null;
  /** Index within the current sequence. */
  index: number;
  /** True once something failed to play by any means on this device. */
  unavailable: boolean;
}

const SPEECH_LANG: Record<Language, string[]> = { en: ["en-IN", "en-GB", "en-US", "en"], hi: ["hi-IN", "hi"] };

/**
 * Plays bundled audio clips, falling back to the Web Speech API. Starting anything
 * new stops whatever was playing (letter changes, navigation). Never "pretends":
 * if neither a clip nor a matching voice can play, state.unavailable becomes true.
 */
class Speaker {
  private generation = 0;
  private audio: HTMLAudioElement | null = null;
  private cancelPending: (() => void) | null = null;
  private listeners = new Set<() => void>();
  state: SpeakerState = { playing: false, key: null, index: -1, unavailable: false };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;
  private set(patch: Partial<SpeakerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  stop() {
    this.generation++;
    this.cancelPending?.();
    this.cancelPending = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (this.state.playing) this.set({ playing: false, key: null, index: -1 });
  }

  /** Warms the HTTP cache so the first tap plays instantly. */
  preload(urls: string[]) {
    for (const url of urls) {
      const a = new Audio();
      a.preload = "auto";
      a.src = url;
    }
  }

  async play(items: SpeakItem[], opts: { key?: string; gapMs?: number } = {}): Promise<"done" | "stopped" | "unavailable"> {
    this.stop();
    const gen = this.generation;
    let failed = false;
    this.set({ playing: true, key: opts.key ?? null, index: 0 });
    for (let i = 0; i < items.length; i++) {
      if (gen !== this.generation) return "stopped";
      this.set({ index: i });
      const ok = (items[i].clip && (await this.playClip(items[i].clip!, gen))) || (await this.speak(items[i], gen));
      if (gen !== this.generation) return "stopped";
      if (!ok) failed = true;
      if (i < items.length - 1 && opts.gapMs) await this.wait(opts.gapMs, gen);
    }
    if (gen !== this.generation) return "stopped";
    this.set({ playing: false, key: null, index: -1, unavailable: this.state.unavailable || failed });
    return failed ? "unavailable" : "done";
  }

  private wait(ms: number, gen: number) {
    return new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      this.cancelPending = () => {
        clearTimeout(t);
        resolve();
      };
      if (gen !== this.generation) resolve();
    });
  }

  private playClip(url: string, gen: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (gen !== this.generation) return resolve(false);
      const a = this.audio ?? (this.audio = new Audio());
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        a.onended = a.onerror = null;
        resolve(ok);
      };
      this.cancelPending = () => done(true);
      a.onended = () => done(true);
      a.onerror = () => done(false);
      a.src = url;
      a.currentTime = 0;
      a.play().catch(() => done(false)); // e.g. blocked autoplay or missing file
    });
  }

  private pickVoice(lang: Language): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    for (const code of SPEECH_LANG[lang]) {
      const v = voices.find((x) => x.lang.toLowerCase().replace("_", "-").startsWith(code.toLowerCase()));
      if (v) return v;
    }
    return null;
  }

  private speak(item: SpeakItem, gen: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve(false);
      const voice = this.pickVoice(item.lang);
      if (!voice) return resolve(false); // no matching voice — don't read Hindi with an English voice
      const u = new SpeechSynthesisUtterance(item.text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.85;
      let settled = false;
      const done = (ok: boolean) => {
        if (!settled) {
          settled = true;
          clearTimeout(guard);
          resolve(ok);
        }
      };
      // Some engines never fire onend; don't hang the sequence.
      const guard = setTimeout(() => done(true), Math.max(2500, item.text.length * 160));
      u.onend = () => done(true);
      u.onerror = (e) => done(e.error === "interrupted" || e.error === "canceled");
      this.cancelPending = () => done(true);
      if (gen !== this.generation) return done(false);
      window.speechSynthesis.speak(u);
    });
  }
}

export const speaker = new Speaker();

/** Short rising chime for a completed trace (WebAudio, no asset needed). */
export function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.42);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio blocked — the visual celebration still shows */
  }
}
