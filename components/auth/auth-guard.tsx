"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const currentUsername = useAuthStore((s) => s.currentUsername);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // localStorage'ı doğrudan oku → giriş yoksa anında yönlendir
    try {
      const raw    = localStorage.getItem("airjen-auth");
      const parsed = raw ? JSON.parse(raw) : null;
      const username: string | null = parsed?.state?.currentUsername ?? null;

      if (!username) {
        // Giriş yok → hemen login'e yönlendir
        router.replace("/login");
        setChecked(true);
        return;
      }
    } catch {
      router.replace("/login");
      setChecked(true);
      return;
    }

    // Giriş var → Zustand store'un hydrate olması için kısa bekleme
    const t = setTimeout(() => setChecked(true), 40);
    return () => clearTimeout(t);
  }, [router]);

  // Zustand hydrate olduktan sonra da kontrol et
  useEffect(() => {
    if (checked && !currentUsername) router.replace("/login");
  }, [checked, currentUsername, router]);

  // Yükleniyor — spinner göster (boş ekran yok)
  if (!checked || !currentUsername) {
    return (
      <div className="min-h-screen bg-[#070918] flex items-center justify-center">
        <div
          className="w-10 h-10 rounded-full border-2 animate-spin"
          style={{
            borderColor: "rgba(14,165,233,0.15)",
            borderTopColor: "#0EA5E9",
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
