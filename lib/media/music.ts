import { clamp } from "./geometry";

// Catalogo musicale. I brani attuali sono generati nel browser (nessun asset con licenza da verificare).
// Per aggiungere un file audio: mettilo in public/music e aggiungi
//   { id, title, artist, durationSeconds, load: () => loadAudioFile("/music/brano.mp3") }
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  load: () => Promise<AudioBuffer>;
}

const SAMPLE_RATE = 44100;

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface SynthOptions {
  bpm: number;
  durationSeconds: number;
  /** Nota MIDI della tonica. */
  root: number;
  /** Un accordo per battuta, in semitoni dalla tonica. */
  progression: number[][];
}

/**
 * Brano originale sintetizzato: cassa, rullante, charleston, basso e accordi.
 * Si renderizza una battuta per accordo e poi si concatenano i campioni: con tutte le note
 * in un unico grafo il rendering di 90 s richiedeva oltre 10 s.
 */
async function synthTrack({ bpm, durationSeconds, root, progression }: SynthOptions): Promise<AudioBuffer> {
  const bar = (60 / bpm) * 4;
  const bars = await Promise.all(progression.map((chord) => synthBar(bpm, root, chord)));
  const out = new AudioBuffer({ length: Math.round(SAMPLE_RATE * durationSeconds), numberOfChannels: 2, sampleRate: SAMPLE_RATE });
  for (let c = 0; c < 2; c++) {
    const data = out.getChannelData(c);
    for (let b = 0; b * bar < durationSeconds; b++) {
      copyInto(data, bars[b % bars.length].getChannelData(c), Math.round(b * bar * SAMPLE_RATE));
    }
    // Dissolvenza finale di 2 s.
    const fade = 2 * SAMPLE_RATE;
    for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
  }
  return out;
}

async function synthBar(bpm: number, root: number, chord: number[]): Promise<AudioBuffer> {
  const beat = 60 / bpm;
  const len = beat * 4;
  const ctx = new OfflineAudioContext(2, Math.round(SAMPLE_RATE * len), SAMPLE_RATE);
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  const noise = ctx.createBuffer(1, SAMPLE_RATE / 2, SAMPLE_RATE);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const env = (t: number, peak: number, decay: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    g.connect(master);
    return g;
  };
  const kick = (t: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(env(t, 0.9, 0.3));
    o.start(t);
    o.stop(t + 0.3);
  };
  const hiss = (t: number, cutoff: number, peak: number, decay: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    s.connect(f).connect(env(t, peak, decay));
    s.start(t);
    s.stop(t + decay);
  };
  const tone = (t: number, midi: number, len: number, type: OscillatorType, cutoff: number, peak: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = midiToHz(midi);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setValueAtTime(peak, t + len * 0.8);
    g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + len);
  };

  for (const n of chord) tone(0, root + 12 + n, len, "sawtooth", 1400, 0.05);
  for (let q = 0; q < 4; q++) {
    const t = q * beat;
    if (q % 2 === 0) kick(t);
    else hiss(t, 1200, 0.5, 0.18);
    tone(t, root - 12 + chord[0], beat * 0.9, "triangle", 500, 0.35);
    hiss(t, 7000, 0.18, 0.05);
    hiss(t + beat / 2, 7000, 0.12, 0.05);
  }
  return ctx.startRendering();
}

export async function loadAudioFile(url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Brano non disponibile (${res.status})`);
  return new OfflineAudioContext(2, 1, SAMPLE_RATE).decodeAudioData(await res.arrayBuffer());
}

const cache = new Map<string, Promise<AudioBuffer>>();
const cached = (id: string, load: () => Promise<AudioBuffer>) => () => {
  if (!cache.has(id)) cache.set(id, load());
  return cache.get(id)!;
};

const track = (id: string, title: string, opts: SynthOptions): MusicTrack => ({
  id,
  title,
  artist: "Fantacup Studio",
  durationSeconds: opts.durationSeconds,
  load: cached(id, () => synthTrack(opts)),
});

export const MUSIC_CATALOG: MusicTrack[] = [
  track("curva-in-festa", "Curva in festa", {
    bpm: 120,
    durationSeconds: 75,
    root: 48,
    progression: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],
  }),
  track("notte-di-coppa", "Notte di coppa", {
    bpm: 92,
    durationSeconds: 90,
    root: 45,
    progression: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
  }),
  track("coro-breve", "Coro breve", {
    bpm: 140,
    durationSeconds: 20,
    root: 50,
    progression: [[0, 4, 7], [5, 9, 12]],
  }),
];

export const findTrack = (id: string) => MUSIC_CATALOG.find((t) => t.id === id);

/** Il brano deve coprire tutta la clip quando possibile; se è più corto si parte da 0. */
export function clampMusicStart(start: number, trackDuration: number, clipDuration: number): number {
  return clamp(start, 0, Math.max(0, trackDuration - clipDuration));
}

/** Secondi di clip coperti dal brano; il resto resta in silenzio (niente loop). */
export function musicCoverage(start: number, trackDuration: number, clipDuration: number): number {
  return clamp(trackDuration - start, 0, clipDuration);
}

/** Copia src in target dalla posizione offset; le parti fuori da target vengono scartate. */
export function copyInto(target: Float32Array, src: Float32Array, offset: number) {
  const from = Math.max(0, -offset);
  const to = Math.max(0, offset);
  const n = Math.min(src.length - from, target.length - to);
  if (n > 0) target.set(src.subarray(from, from + n), to);
}

/** Estratto di durata esatta dal punto start; la parte non coperta dal brano resta in silenzio. */
export function sliceAudio(buffer: AudioBuffer, start: number, duration: number): AudioBuffer {
  const out = new AudioBuffer({
    length: Math.round(duration * buffer.sampleRate),
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  const offset = -Math.round(start * buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    copyInto(out.getChannelData(c), buffer.getChannelData(c), offset);
  }
  return out;
}
