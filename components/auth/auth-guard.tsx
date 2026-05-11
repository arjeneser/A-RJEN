"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router          = useRouter();
  const currentUsername = useAuthStore((s) => s.currentUsername);
  const [checked, setChecked] = useState(false);

  // 1. Oturum key'ini oku — yoksa anında login'e yönlendir
  useEffect(() => {
    try {
      // Yeni sistem: airjen-user (localStorage veya sessionStorage)
      const newSession =
        localStorage.getItem("airjen-user") ||
        sessionStorage.getItem("airjen-user");

      // Eski sistem (geriye dönük uyumluluk): airjen-auth içindeki currentUsername
      const legacyRaw = localStorage.getItem("airjen-auth");
      const legacyUsername = legacyRaw
        ? (JSON.parse(legacyRaw)?.state?.currentUsername ?? null)
        : null;

      if (!newSession && !legacyUsername) {
        // Hiç oturum yok → login'e yönlendir
        router.replace("/login");
        setChecked(true);
        return;
      }

      // Eski sistemden geçiş: airjen-user'ı otomatik oluştur
      if (!newSession && legacyUsername) {
        localStorage.setItem("airjen-user", legacyUsername);
      }
    } catch {
      router.replace("/login");
      setChecked(true);
      return;
    }

    // Oturum var → AuthProvider'ın currentUsername'i restore etmesini bekle.
    // currentUsername gelince aşağıdaki effect hemen devreye girer.
    // 300ms fallback: yine de boş kalmaz.
    const t = setTimeout(() => setChecked(true), 300);
    return () => clearTimeout(t);
  }, [router]);

  // 2. currentUsername set olunca beklemeyi bitir (timeout'u bekleme)
  useEffect(() => {
    if (currentUsername) setChecked(true);
  }, [currentUsername]);

  // 3. 300ms geçti, hâlâ username yok → login
  useEffect(() => {
    if (checked && !currentUsername) router.replace("/login");
  }, [checked, currentUsername, router]);

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
