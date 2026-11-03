"use client";

import { useEffect, useSyncExternalStore } from "react";
import { siteConfig } from "@/lib/site";

export const SPLASH_SEEN_STORAGE_KEY = "dcup_splash_seen";
export const SPLASH_DISMISSED_EVENT = "dcup:splash-dismissed";

const STORAGE_KEY = SPLASH_SEEN_STORAGE_KEY;

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
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export default function SplashScreen() {
  const visible = useSyncExternalStore(subscribe, getClientSnapshot, () => false);

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    dismissedInMemory = true;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage non disponibile: nascondiamo comunque per questa sessione.
    }
    emit();
    window.dispatchEvent(new Event(SPLASH_DISMISSED_EVENT));
  };

  return (
    <div className="md:hidden fixed inset-0 z-200 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="/images/splash-bg.jpg"
          alt="background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "rgba(9,20,76,0.25)" }} />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-10 pt-26">
          <img
            src="/images/splash-logo.svg"
            alt="Fantadc"
            width={101}
            height={106}
            style={{ objectFit: "contain" }}
          />
          <div className="flex flex-col items-center gap-6 text-white text-center">
            <p className="text-base font-medium">Benvenuto alla</p>
            <div
              className="flex flex-col text-4xl items-center uppercase leading-tight gap-4"
              style={{ fontFamily: "var(--font-tallica)"}}
            >
              {siteConfig.titleLines.map((line) => <span key={line}>{line}</span>)}
            </div>
          </div>
        </div>

        {/* Button */}
        <button
          type="button"
          onClick={dismiss}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-xl flex items-center justify-center"
          style={{ width: 208, paddingTop: 12, paddingBottom: 12 }}
        >
          <span className="text-base font-semibold" style={{ color: "#09144C" }}>
            Entra nel torneo
          </span>
        </button>
      </div>
    </div>
  );
}
