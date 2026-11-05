"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findTrack } from "@/lib/media/music";
import type { MediaComposition } from "@/lib/media/types";

/**
 * Riproduzione dell'anteprima video dentro il trim, con la musica scelta suonata via Web Audio
 * (l'audio originale del video viene silenziato quando c'è una musica).
 */
export function useVideoPreview(video: HTMLVideoElement | null, composition: MediaComposition) {
  // Valori primitivi: la composizione cambia identità a ogni modifica, la musica non deve ripartire.
  const trimStart = composition.trim?.start ?? 0;
  const trimEnd = composition.trim?.end ?? 0;
  const trackId = composition.music?.trackId;
  const musicStart = composition.music?.startTimeSeconds ?? 0;

  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  // Scarta i caricamenti del brano superati da una richiesta più recente.
  const musicRequest = useRef(0);
  const [playing, setPlaying] = useState(false);

  /** Da chiamare dentro un gesto dell'utente: su iOS l'AudioContext parte solo così. */
  const prepareAudio = useCallback(() => {
    audioRef.current ??= new AudioContext();
    void audioRef.current.resume();
  }, []);

  const stopMusic = useCallback(() => {
    musicRequest.current++;
    try {
      sourceRef.current?.stop();
    } catch {
      // già fermo
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
  }, []);

  const startMusic = useCallback(async () => {
    const ctx = audioRef.current;
    const track = trackId ? findTrack(trackId) : undefined;
    if (!video || !track || !ctx) return;
    stopMusic();
    const request = musicRequest.current;
    const buffer = await track.load();
    if (request !== musicRequest.current || video.paused) return;
    const offset = musicStart + (video.currentTime - trimStart);
    if (offset >= buffer.duration) return;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.start(0, Math.max(0, offset));
    sourceRef.current = node;
  }, [video, trackId, musicStart, trimStart, stopMusic]);

  // Audio originale solo senza musica; la musica riparte a ogni cambio di brano o di punto di partenza.
  useEffect(() => {
    if (!video) return;
    video.muted = !!trackId;
    if (playing) void startMusic();
    return stopMusic;
  }, [video, trackId, playing, startMusic, stopMusic]);

  useEffect(() => {
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    // Dopo un salto (anche il ritorno a inizio trim) la musica deve riallinearsi.
    const onSeeked = () => {
      if (!video.paused) void startMusic();
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [video, startMusic]);

  // Ciclo dentro il trim.
  useEffect(() => {
    if (!video || !playing) return;
    let raf = 0;
    const tick = () => {
      if (video.currentTime >= trimEnd) video.currentTime = trimStart;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [video, trimStart, trimEnd, playing]);

  useEffect(() => () => void audioRef.current?.close(), []);

  const seek = useCallback(
    (t: number) => {
      if (!video) return;
      video.pause();
      video.currentTime = t;
    },
    [video]
  );

  /** Riproduce (dall'inizio del trim se richiesto o fuori intervallo) e avvia l'AudioContext. */
  const play = useCallback(
    (fromStart = false) => {
      if (!video) return;
      prepareAudio();
      if (fromStart || video.currentTime < trimStart || video.currentTime >= trimEnd) video.currentTime = trimStart;
      void video.play();
    },
    [video, trimStart, trimEnd, prepareAudio]
  );

  const toggle = useCallback(() => (playing ? video?.pause() : play()), [playing, video, play]);

  return { playing, toggle, play, seek, prepareAudio };
}
