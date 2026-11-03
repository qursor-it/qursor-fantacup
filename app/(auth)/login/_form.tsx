"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { login } from "@/app/actions/auth";
import { siteConfig } from "@/lib/site";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const registered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");

  return (
    <>
      {registered && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: "rgba(50,215,75,0.12)", color: "#32D74B", border: "1px solid rgba(50,215,75,0.24)" }}>
          Registrazione completata! Accedi con le tue credenziali.
        </div>
      )}

      <form action={action} className="flex flex-col gap-5">
        {next && <input type="hidden" name="next" value={next} />}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }} htmlFor="email">
            Email
          </label>
          <InputText
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full"
            placeholder="la-tua@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }} htmlFor="login-password">
            Password
          </label>
          <Password
            inputId="login-password"
            name="password"
            autoComplete="current-password"
            feedback={false}
            toggleMask
            className="w-full"
            inputClassName="w-full"
            placeholder="••••••••"
          />
        </div>

        {state?.message && (
          <p className="text-sm" style={{ color: "#DC2626" }}>{state.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full flex items-center justify-center py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--text-primary)" }}
        >
          {pending ? "Accesso in corso..." : "Accedi"}
        </button>

        <p className="text-xs text-center leading-5" style={{ color: "var(--text-disabled)" }}>
          Password dimenticata? Per cambiarla scrivi agli amministratori sulla{" "}
          <a
            href="https://www.instagram.com/danimarcas_cup/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
          >
            pagina Instagram ufficiale
          </a>{" "}
          di {siteConfig.name}.
        </p>
      </form>
    </>
  );
}
