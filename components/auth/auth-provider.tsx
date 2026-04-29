"use client";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUserStore } from "@/store/user-store";
import { registerPresence } from "@/lib/friends";
import { requestNotificationPermission } from "@/lib/notifications";

/**
 * AuthProvider
 * ─────────────
 * • Sayfa yüklenince "beni hatırla" oturumunu geri yükler
 *   (localStorage → kalıcı | sessionStorage → sekme kapanınca sona erer)
 * • Giriş yapan kullanıcının snapshot'ını useUserStore'a yükler.
 * • useUserStore değişimlerinde otomatik snapshot kaydeder.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { currentUsername, getSnapshot, saveSnapshot, setCurrentUser, credentials } = useAuthStore();
  const { loadSnapshot, exportSnapshot, resetToDefault } = useUserStore();
  const loadedRef    = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef  = useRef(false);

  // ── Oturum geri yükleme (sayfa yükleme / yenileme) ───────────────────────
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (currentUsername) return; // Zustand persist zaten yükledi

    const saved =
      localStorage.getItem("airjen-session") ||
      sessionStorage.getItem("airjen-session");

    if (saved && credentials[saved]) {
      setCurrentUser(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Kullanıcı adı değişince snapshot yükle ────────────────────────────────
  useEffect(() => {
    if (!currentUsername) {
      if (loadedRef.current !== null) {
        resetToDefault();
        loadedRef.current = null;
      }
      return;
    }

    if (loadedRef.current === currentUsername) return;
    loadedRef.current = currentUsername;

    registerPresence(currentUsername);
    requestNotificationPermission();

    const snap = getSnapshot(currentUsername);
    if (snap) {
      loadSnapshot(snap);
    } else {
      resetToDefault();
    }
  }, [currentUsername, getSnapshot, loadSnapshot, resetToDefault]);

  // ── Snapshot otomatik kayıt (debounced) ───────────────────────────────────
  useEffect(() => {
    if (!currentUsername) return;

    const unsub = useUserStore.subscribe(() => {
      if (!currentUsername) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const snap = exportSnapshot();
        saveSnapshot(currentUsername, snap);
      }, 800);
    });

    return () => {
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentUsername, exportSnapshot, saveSnapshot]);

  return <>{children}</>;
}
