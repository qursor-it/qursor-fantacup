"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { MAX_VIDEO_SECONDS } from "@/lib/media/composition";
import { formatClock } from "./format";
import { useCamera, type Facing } from "./use-camera";

type Mode = "photo" | "video";

const RECORDER_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export default function CameraView({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File, opts: { flipH: boolean }) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [mode, setMode] = useState<Mode>("photo");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const { stream, error, notice, canSwitch, start, stop } = useCamera();

  const canRecord = typeof MediaRecorder !== "undefined";

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    void start(facing, mode === "video");
  }, [start, facing, mode]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  // Con la scheda in background la camera va rilasciata; una registrazione in corso viene conclusa e tenuta.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        if (recorderRef.current?.state === "recording") stopRecording();
        else stop();
      } else if (!recorderRef.current || recorderRef.current.state === "inactive") {
        void start(facing, mode === "video");
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [facing, mode, start, stop, stopRecording]);

  // Smontaggio: niente file dalla registrazione interrotta.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const rec = recorderRef.current;
      if (rec) {
        rec.onstop = null;
        rec.onerror = null;
        if (rec.state === "recording") rec.stop();
      }
    },
    []
  );

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return setMessage("Impossibile scattare la foto.");
        onCapture(new File([blob], "foto.jpg", { type: blob.type }), { flipH: facing === "user" });
      },
      "image/jpeg",
      0.92
    );
  }

  function startRecording() {
    if (!stream) return;
    const mimeType = RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const flipH = facing === "user";
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (e) {
      console.error(e);
      return setMessage("Registrazione non supportata da questo browser.");
    }
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onerror = () => {
      setMessage("Errore durante la registrazione.");
      stopRecording();
    };
    recorder.onstop = () => {
      recorderRef.current = null;
      setRecording(false);
      const type = recorder.mimeType.split(";")[0] || "video/webm";
      if (!chunks.length) return setMessage("Registrazione vuota: riprova.");
      onCapture(new File(chunks, type === "video/mp4" ? "video.mp4" : "video.webm", { type }), { flipH });
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setMessage(null);
    setElapsed(0);
    setRecording(true);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      setElapsed(s);
      if (s >= MAX_VIDEO_SECONDS) stopRecording();
    }, 250);
  }

  function onGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onCapture(file, { flipH: false });
  }

  const shown = error ?? message ?? notice;
  const tabs: { id: Mode; label: string; disabled?: boolean }[] = [
    { id: "photo", label: "Foto" },
    { id: "video", label: "Video", disabled: !canRecord || recording },
  ];

  return (
    <div className="absolute inset-0 flex flex-col">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
      />

      <div className="relative flex items-center justify-between p-2">
        <Button
          type="button"
          icon="pi pi-times"
          text
          rounded
          aria-label="Chiudi"
          onClick={onCancel}
          style={{ background: "rgba(0,0,0,0.35)" }}
        />
        {recording && (
          <div className="flex items-center gap-2 rounded-full px-3 py-1 text-sm tabular-nums" style={{ background: "rgba(0,0,0,0.5)" }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            {formatClock(elapsed)} / {formatClock(MAX_VIDEO_SECONDS)}
          </div>
        )}
        {canSwitch ? (
          <Button
            type="button"
            icon="pi pi-sync"
            text
            rounded
            aria-label="Cambia fotocamera"
            disabled={recording}
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            style={{ background: "rgba(0,0,0,0.35)" }}
          />
        ) : (
          <span className="w-11" />
        )}
      </div>

      {shown && (
        <div className="relative mx-4 mt-2 rounded-xl px-3 py-2 text-center text-sm" style={{ background: "rgba(0,0,0,0.6)" }}>
          {shown}
        </div>
      )}

      <div className="relative mt-auto flex flex-col items-center gap-3 pb-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
        {!canRecord && <p className="text-xs text-white/70">Registrazione video non supportata da questo browser.</p>}
        <div className="flex items-center gap-2">
          {tabs.map((t) => (
            <Button
              key={t.id}
              type="button"
              label={t.label}
              text
              rounded
              disabled={t.disabled}
              className={mode === t.id ? "mc-active" : undefined}
              onClick={() => setMode(t.id)}
            />
          ))}
          <Button
            type="button"
            label="Galleria"
            icon="pi pi-images"
            text
            rounded
            disabled={recording}
            onClick={() => inputRef.current?.click()}
          />
        </div>
        <Button
          type="button"
          aria-label={mode === "photo" ? "Scatta" : recording ? "Ferma registrazione" : "Registra"}
          disabled={!stream}
          onClick={mode === "photo" ? takePhoto : recording ? stopRecording : startRecording}
          className="mc-bare"
          style={{ width: 72, height: 72 }}
        >
          <span
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{ border: "4px solid #fff" }}
          >
            <span
              style={{
                width: recording ? 28 : 56,
                height: recording ? 28 : 56,
                borderRadius: recording ? 6 : 9999,
                background: mode === "video" ? "#EF4444" : "#fff",
                transition: "all 0.15s",
              }}
            />
          </span>
        </Button>
      </div>

      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={onGalleryFile} />
    </div>
  );
}
