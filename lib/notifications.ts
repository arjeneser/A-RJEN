/** Tarayıcı bildirim izni iste */
export function requestNotificationPermission() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

/** Tarayıcı bildirimi göster (izin varsa) */
export function showBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void
) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
      };
    }
    // 8 saniye sonra otomatik kapat
    setTimeout(() => n.close(), 8000);
  } catch {
    /* Safari gibi bazı tarayıcılar hata verebilir */
  }
}
