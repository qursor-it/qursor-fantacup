import type { Metadata } from "next";
import { DesktopServicePage } from "@/components/mobile-only-gate";

export const metadata: Metadata = {
  title: "Apri da mobile",
};

export default function DesktopUnavailablePage() {
  return <DesktopServicePage />;
}
