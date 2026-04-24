"use client";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUserStore } from "@/store/user-store";
import { registerPresence } from "@/lib/friends";
import { requestNotificationPermission } from "@/lib/notifications";

/**
 * AuthProvider
 * ─────────────
 * • On mount: if a user is logged in, load their snapshot into useUserStore.
 * • Subscribes to useUserStore changes and auto-saves snapshots to auth store
 *   so data is never lost.
 * • Must be rendered inside the app root (layout.tsx).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { currentUsername, getSnapshot, saveSnapshot } = useAuthStore();
  const { loadSnapshot, exportSnapshot, resetToDefault } = useUserStore();
  const loadedRef  = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load snapshot when username changes (login / page refresh) ────────────
  useEffect(() => {
    if (!currentUsername) {
      // Not logged in — keep store empty
      if (loadedRef.current !== null) {
        resetToDefault();
        loadedRef.current = null;
      }
      return;
    }

    if (loadedRef.current === currentUsername) return; // already loaded
    loadedRef.current = currentUsername;

    // Firebase'de kullanıcı varlığını kaydet (arkadaş arama için)
    registerPresence(currentUsername);
    // Bildirim izni iste
    requestNotificationPermission();

    const snap = getSnapshot(currentUsername);
    if (snap) {
      loadSnapshot(snap);
    } else {
      resetToDefault(); // new user → fresh profile
    }
  }, [currentUsername, getSnapshot, loadSnapshot, resetToDefault]);

  // ── Auto-save snapshot to auth store on every user store change ───────────
  useEffect(() => {
    if (!currentUsername) return;

    const unsub = useUserStore.subscribe(() => {
      if (!currentUsername) return;
      // Debounce 800ms to avoid hammering storage on rapid changes
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
