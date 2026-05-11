"use client";
import { useEffect, useRef } from "react";
import { useAuthStore, useSnapshotStore } from "@/store/auth-store";
import { useUserStore } from "@/store/user-store";
import { registerPresence } from "@/lib/friends";
import { requestNotificationPermission } from "@/lib/notifications";
import { loadUserSnapshot, saveUserSnapshot } from "@/lib/user-sync";

/**
 * AuthProvider
 * ─────────────
 * • Sayfa yüklenince "beni hatırla" oturumunu geri yükler
 * • Giriş yapan kullanıcının snapshot'ını yükler:
 *     1. localStorage (hız için)
 *     2. Firebase (daha yeni veri varsa override eder)
 * • useUserStore değişimlerinde localStorage + Firebase'e otomatik kaydeder.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { currentUsername, setCurrentUser } = useAuthStore();
  const { getSnapshot, saveSnapshot } = useSnapshotStore();
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

    if (saved) {
      // Zustand henüz hydrate olmamış olabilir — önce in-memory state'i dene,
      // sonra localStorage'dan direkt oku (timing güvencesi için)
      const { credentials } = useAuthStore.getState();
      if (credentials[saved]) {
        setCurrentUser(saved);
      } else {
        try {
          const raw = localStorage.getItem("airjen-auth");
          const parsed = raw ? JSON.parse(raw) : null;
          const stored = parsed?.state?.credentials ?? {};
          if (stored[saved]) {
            // Zustand'ı güncelle ve kullanıcıyı set et
            useAuthStore.setState({ credentials: stored });
            setCurrentUser(saved);
          }
        } catch {
          // localStorage okunamazsa sessizce geç
        }
      }
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

    // 1. Önce localStorage'dan hızlıca yükle
    const localSnap = getSnapshot(currentUsername);
    if (localSnap) {
      loadSnapshot(localSnap);
    } else {
      resetToDefault();
    }

    // 2. Firebase'den yükle — daha yeni veri varsa üzerine yaz
    loadUserSnapshot(currentUsername).then((cloudSnap) => {
      if (!cloudSnap) return;

      // CRITICAL: Firebase yanıtı geldiğinde en güncel local snapshot'ı kullan.
      // Başlangıçta yakalanan `localSnap` bu sürede güncellenmiş olabilir
      // (örn. başarı sayfasından yeni uçuş kaydedilmiş olabilir).
      const currentLocalSnap = useSnapshotStore.getState().getSnapshot(currentUsername);
      const localUpdated = (currentLocalSnap as any)?.lastUpdated ?? 0;
      const cloudUpdated = cloudSnap.lastUpdated ?? 0;

      // Firebase daha yeni ya da local hiç yoksa Firebase'i kullan
      if (cloudUpdated > localUpdated || !currentLocalSnap) {
        loadSnapshot({
          profile:      cloudSnap.profile,
          history:      cloudSnap.history,
          stamps:       cloudSnap.stamps,
          achievements: cloudSnap.achievements ?? [],
        });
        // Local'a da kaydet ki bir sonraki açılışta hızlı yüklensin
        saveSnapshot(currentUsername, {
          profile:      cloudSnap.profile,
          history:      cloudSnap.history,
          stamps:       cloudSnap.stamps,
          achievements: cloudSnap.achievements ?? [],
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUsername]);

  // ── Snapshot otomatik kayıt — localStorage (hemen) + Firebase (debounced) ─
  useEffect(() => {
    if (!currentUsername) return;

    const unsub = useUserStore.subscribe(() => {
      if (!currentUsername) return;

      // localStorage'a hemen kaydet
      const snap = exportSnapshot();
      saveSnapshot(currentUsername, snap);

      // Firebase'e debounced kaydet (800ms — hızlı art arda değişimleri birleştir)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const latestSnap = exportSnapshot();
        saveUserSnapshot(currentUsername, latestSnap);
      }, 800);
    });

    return () => {
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentUsername, exportSnapshot, saveSnapshot]);

  return <>{children}</>;
}
