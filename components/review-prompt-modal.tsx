"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { appStoreConfig } from "@/lib/site";
import { REVIEW_PROMPT_OPEN_EVENT } from "@/lib/review-prompt-trigger";
import { shouldShowDesktopService } from "./mobile-only-gate";
import { SPLASH_SEEN_STORAGE_KEY, SPLASH_DISMISSED_EVENT } from "./splash-screen";
import StoreBadge from "./store-badge";
import type { ReviewPromptPlayer } from "@/lib/review-prompt";

const STORAGE_PREFIX = "fantadc:review-prompt:";
const SHOW_AT_SESSION = 1;
const SNOOZE_SESSIONS = 4;

const MESSAGES = [
  "se ti sto facendo fare punti, una recensione mi farebbe più felice di un gol all'ultimo minuto",
  "non chiedo la fascia da capitano, solo cinque stelline su questa app",
  "sono qui a giocare per la tua squadra, tu gioca per la mia recensione",
  "un rigore lo sbaglio, una recensione da 5 stelle no",
];

function detectStoreUrl(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return appStoreConfig.appleAppStoreUrl;
  if (/Android/i.test(ua)) return appStoreConfig.googlePlayStoreUrl;
  return null;
}

function pickRandomPlayer(players: ReviewPromptPlayer[]) {
  return players[Math.floor(Math.random() * players.length)];
}

function pickRandomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

export default function ReviewPromptModal({ players }: { players: ReviewPromptPlayer[] }) {
  const [player, setPlayer] = useState<ReviewPromptPlayer | null>(null);
  const [message, setMessage] = useState(pickRandomMessage);
  const [animIn, setAnimIn] = useState(false);
  const [storeUrl] = useState(detectStoreUrl);

  useEffect(() => {
    if (players.length === 0) return;
    if (shouldShowDesktopService()) return; // niente popup fuori da mobile
    if (localStorage.getItem(`${STORAGE_PREFIX}done`)) return;

    function tryShow() {
      // Non sovrapporsi allo splash screen (mostrato solo al primo accesso da mobile).
      if (!localStorage.getItem(SPLASH_SEEN_STORAGE_KEY)) return;

      if (!sessionStorage.getItem(`${STORAGE_PREFIX}counted`)) {
        sessionStorage.setItem(`${STORAGE_PREFIX}counted`, "1");
        const count = Number(localStorage.getItem(`${STORAGE_PREFIX}count`) ?? "0") + 1;
        localStorage.setItem(`${STORAGE_PREFIX}count`, String(count));
      }

      const count = Number(localStorage.getItem(`${STORAGE_PREFIX}count`) ?? "0");
      const nextShowAt = Number(localStorage.getItem(`${STORAGE_PREFIX}nextShowAt`) ?? String(SHOW_AT_SESSION));
      if (count < nextShowAt) return;

      setMessage(pickRandomMessage());
      setPlayer(pickRandomPlayer(players));
    }

    tryShow();
    window.addEventListener(SPLASH_DISMISSED_EVENT, tryShow);
    return () => window.removeEventListener(SPLASH_DISMISSED_EVENT, tryShow);
  }, [players]);

  // Trigger manuale (es. da "Lascia una recensione" in Altro/Profilo): ignora contatori e stato "done".
  useEffect(() => {
    function handleManualOpen() {
      if (players.length === 0) return;
      if (shouldShowDesktopService()) return;
      setMessage(pickRandomMessage());
      setPlayer(pickRandomPlayer(players));
    }
    window.addEventListener(REVIEW_PROMPT_OPEN_EVENT, handleManualOpen);
    return () => window.removeEventListener(REVIEW_PROMPT_OPEN_EVENT, handleManualOpen);
  }, [players]);

  useEffect(() => {
    if (!player) return;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
    return () => { document.body.style.overflow = ""; };
  }, [player]);

  if (!player) return null;

const dismiss = () => {
    setAnimIn(false);
    setTimeout(() => setPlayer(null), 300);
  };

  // Chiudere in qualsiasi modo che non sia "lascia una recensione" rimanda il prompt di qualche sessione,
  // altrimenti ricomparirebbe a ogni accesso una volta superata la soglia.
  const handleLater = () => {
    const count = Number(localStorage.getItem(`${STORAGE_PREFIX}count`) ?? "0");
    localStorage.setItem(`${STORAGE_PREFIX}nextShowAt`, String(count + SNOOZE_SESSIONS));
    dismiss();
  };

  const handleReview = () => {
    localStorage.setItem(`${STORAGE_PREFIX}done`, "1");
    dismiss();
  };

  const firstName = player.name.trim().split(/\s+/)[0];

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-9998"
        style={{ background: "rgba(6,7,61,0.3)", opacity: animIn ? 1 : 0, transition: "opacity 0.3s ease" }}
        onClick={handleLater}
      />

      <div
        className="fixed inset-0 z-9999 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) handleLater(); }}
      >
        <div
          className="bg-white flex flex-col items-center text-center px-6 pt-5 pb-6 gap-4"
          style={{
            borderRadius: 24,
            width: "min(340px, 100%)",
            opacity: animIn ? 1 : 0,
            transform: animIn ? "scale(1)" : "scale(0.95)",
            transition: "opacity 0.25s ease, transform 0.25s ease",
          }}
        >
          <button
            type="button"
            onClick={handleLater}
            aria-label="Chiudi"
            className="self-end w-6 h-6 flex items-center justify-center -mb-2"
            style={{ color: "rgba(9,20,76,0.4)" }}
          >
            <i className="pi pi-times text-sm" />
          </button>

          <img src="/icons/user-player.svg" alt="" className="w-14 h-14 object-contain" />

          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <i key={i} className="pi pi-star-fill text-sm" style={{ color: "#E8A000" }} />
            ))}
          </div>

          <div
            className="relative rounded-2xl px-4 py-3"
            style={{ background: "var(--surface-1)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              <span className="font-semibold">{firstName}:</span> &ldquo;Ehi, {message}!&rdquo;
            </p>
          </div>

          <p className="text-xs" style={{ color: "rgba(0,0,0,0.45)" }}>
            {player.name} · {player.footballTeam.shortName ?? player.footballTeam.name}
          </p>

          <div className="flex flex-col items-center gap-3 w-full mt-1">
            {storeUrl ? (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                onClick={handleReview}
                className="w-full flex items-center justify-center py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "var(--text-primary)" }}
              >
                Lascia una recensione
              </a>
            ) : (
              <div className="flex items-center gap-4" onClick={handleReview}>
                <StoreBadge src="/images/app_store.png" alt="Scarica su App Store" url={appStoreConfig.appleAppStoreUrl} />
                <StoreBadge src="/images/play_store.png" alt="Disponibile su Google Play" url={appStoreConfig.googlePlayStoreUrl} />
              </div>
            )}
            <button
              type="button"
              onClick={handleLater}
              className="text-xs font-medium"
              style={{ color: "rgba(0,0,0,0.45)" }}
            >
              Più tardi
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
