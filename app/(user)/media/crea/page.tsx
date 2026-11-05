import { requireAuth } from "@/lib/session";
import ComposerPage from "./_composer-page";

export const metadata = { title: "Crea foto o video" };

export default async function CreaMediaPage() {
  await requireAuth();
  return <ComposerPage />;
}
