"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUsername = useAuthStore((s) => s.currentUsername);
  const [hydrated, setHydrated] = useState(false);

  // Zustand persist async rehydration'ı bekle
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUsername) router.replace("/login");
  }, [hydrated, currentUsername, router]);

  if (!hydrated || !currentUsername) return null;
  return <>{children}</>;
}
