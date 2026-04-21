"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUsername = useAuthStore((s) => s.currentUsername);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait one tick for Zustand persist to rehydrate
    setChecked(true);
    if (!currentUsername) {
      router.replace("/login");
    }
  }, [currentUsername, router]);

  if (!checked || !currentUsername) return null;
  return <>{children}</>;
}
