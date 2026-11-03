"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const VISITS_KEY = "fdc:mvpHint:visits";
const DISMISSED_KEY = "fdc:mvpHint:dismissed";

const listeners = new Set<() => void>();
let dismissedInMemory = false;

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function emit() {
  listeners.forEach((callback) => callback());
}

function getClientSnapshot() {
  if (dismissedInMemory) return false;
  try {
    if (localStorage.getItem(DISMISSED_KEY) === "1") return false;
    return Number(localStorage.getItem(VISITS_KEY) ?? "0") >= 2;
  } catch {
    return false;
  }
}

/**
 * Card informativa sul voto MVP, mostrata sopra le "Prossime partite" nella homepage.
 * - Non compare al primo accesso: appare dal secondo accesso in poi (contatore in localStorage).
 * - Il pulsante "Ho capito" la nasconde per sempre su quel dispositivo.
 * Parte da `null` (server + primo render client) per evitare mismatch di idratazione.
 */
export default function MvpVoteHintCard() {
  const visible = useSyncExternalStore(subscribe, getClientSnapshot, () => false);
  const ran = useRef(false);

  useEffect(() => {
    // Guard contro il doppio invio dell'effetto in React StrictMode (dev),
    // cosi una singola visita non viene contata due volte.
    if (ran.current) return;
    ran.current = true;

    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;

      const visits = Number(localStorage.getItem(VISITS_KEY) ?? "0") + 1;
      localStorage.setItem(VISITS_KEY, String(visits));
    } catch {
      // localStorage non disponibile (modalita privata / storage disabilitato): non mostrare nulla.
    }
    emit();
  }, []);

  function dismiss() {
    dismissedInMemory = true;
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Se non possiamo persistere, nascondiamo comunque per la sessione corrente.
    }
    emit();
  }

  if (!visible) return null;

  return (
    <section className="max-w-lg mx-auto w-full px-4 mt-10">
      <div
        className="flex flex-col gap-3 bg-white rounded-3xl p-6"
        style={{ border: "1px solid rgba(9,20,76,0.05)", boxShadow: "0 4px 10px 0 rgba(9,20,76,0.10)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--primary-light)" }}
          >
            <i className="pi pi-star-fill" style={{ color: "var(--primary)", fontSize: 18 }} />
          </span>
          <p
            className="uppercase text-(--text-primary) text-base leading-8.5 font-medium"
            style={{ fontFamily: "var(--font-tallica)" }}
          >
            Vota il tuo MVP
          </p>
        </div>
        <p className="text-sm text-black font-normal">
          Dopo ogni partita hai <strong>2 ore </strong> per votare il tuo giocatore preferito della
          partita: l&apos;MVP riceve un bonus di punti fanta!
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--text-primary)" }}
        >
          Ho capito
        </button>
      </div>
    </section>
  );
}
