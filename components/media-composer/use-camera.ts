"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Facing = "user" | "environment";

const UNAVAILABLE = "Fotocamera non disponibile: serve una connessione sicura (HTTPS) e un browser recente.";

function errorMessage(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permesso negato: abilita fotocamera e microfono nelle impostazioni del browser.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Nessuna fotocamera disponibile.";
  if (name === "NotReadableError" || name === "AbortError") return "La fotocamera è già in uso da un'altra app.";
  console.error(e);
  return "Impossibile accedere alla fotocamera.";
}

const request = (facing: Facing, audio: boolean) =>
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio,
  });

/** Stream della fotocamera: start sostituisce lo stream precedente, stop rilascia tutte le tracce. */
export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  // Ignora le risposte di richieste superate da una più recente (o dallo smontaggio).
  const requestId = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canSwitch, setCanSwitch] = useState(false);

  const stop = useCallback(() => {
    requestId.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(
    async (facing: Facing, withAudio: boolean) => {
      stop();
      const id = requestId.current;
      setError(null);
      setNotice(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(UNAVAILABLE);
        return;
      }
      let next: MediaStream;
      try {
        try {
          next = await request(facing, withAudio);
        } catch (e) {
          if (!withAudio || !(e instanceof DOMException) || e.name !== "NotAllowedError") throw e;
          next = await request(facing, false);
          if (id === requestId.current) setNotice("Microfono non disponibile: il video sarà registrato senza audio");
        }
      } catch (e) {
        if (id === requestId.current) setError(errorMessage(e));
        return;
      }
      if (id !== requestId.current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = next;
      setStream(next);
      // Le etichette e l'elenco completo delle camere sono disponibili solo dopo il permesso.
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (id === requestId.current) setCanSwitch(devices.filter((d) => d.kind === "videoinput").length >= 2);
    },
    [stop]
  );

  useEffect(() => stop, [stop]);

  return { stream, error, notice, canSwitch, start, stop };
}
