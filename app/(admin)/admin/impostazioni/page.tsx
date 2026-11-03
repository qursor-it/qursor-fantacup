import { getRegistrationOpen, getTournamentConcluded } from "@/lib/app-settings";
import { setRegistrationOpenAction, setTournamentConcludedAction } from "@/app/actions/admin/settings";
import AdminPageHeader from "@/components/admin-page-header";
import SettingToggle from "./_toggle";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const cardStyle = {
  background: "#fff",
  border: "1px solid var(--border-soft)",
  boxShadow: "0 1px 4px rgba(9,20,76,0.06)",
};

export default async function ImpostazioniPage() {
  await requireAdmin();
  const [registrationOpen, tournamentConcluded] = await Promise.all([
    getRegistrationOpen(),
    getTournamentConcluded(),
  ]);

  return (
    <div>
      <AdminPageHeader title="Impostazioni" />

      <div className="flex flex-col gap-3">
        <div className="rounded-2xl px-5 py-4" style={cardStyle}>
          <SettingToggle
            initialValue={registrationOpen}
            action={setRegistrationOpenAction}
            label="Registrazione utenti"
            onText="Aperte — chiunque può registrarsi."
            offText="Chiuse — la pagina mostra un avviso."
            onToast="Registrazioni aperte."
            offToast="Registrazioni chiuse."
          />
        </div>

        <div className="rounded-2xl px-5 py-4" style={cardStyle}>
          <SettingToggle
            initialValue={tournamentConcluded}
            action={setTournamentConcludedAction}
            label="Torneo concluso"
            onText="Attivo — i visitatori vedono solo la pagina “Torneo concluso”. Gli admin vedono tutto."
            offText="Disattivo — il sito è normalmente accessibile."
            onToast="Torneo segnato come concluso."
            offToast="Sito riaperto."
            onColor="#E8A000"
          />
        </div>
      </div>
    </div>
  );
}
