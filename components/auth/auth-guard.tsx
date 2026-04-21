"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUsername = useAuthStore((s) => s.currentUsername);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Zustand persist localStorage'dan yüklensin diye kısa bekleme
    const timer = setTimeout(() => {
      setChecked(true);
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!checked) return;
    if (!currentUsername) router.replace("/login");
  }, [checked, currentUsername, router]);

  if (!checked || !currentUsername) return null;
  return <>{children}</>;
}
