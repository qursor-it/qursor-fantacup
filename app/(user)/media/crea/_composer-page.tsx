"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const MediaComposer = dynamic(() => import("@/components/media-composer/media-composer"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white">
      <i className="pi pi-spin pi-spinner text-3xl" />
    </div>
  ),
});

export default function ComposerPage() {
  const router = useRouter();
  return (
    <MediaComposer
      onCancel={() => (window.history.length > 1 ? router.back() : router.push("/dashboard"))}
    />
  );
}
