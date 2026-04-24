"use client";
/**
 * NotificationHub
 * ────────────────
 * Firebase'den gelen mesajları ve uçuş davetlerini dinler,
 * yeni bildirim gelince toast + tarayıcı bildirimi gösterir.
 * Layout'ta tek bir kere render edilir.
 */
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useToastStore } from "@/store/toast-store";
import { subscribeToFriends } from "@/lib/friends";
import { subscribeToMessages } from "@/lib/messages";
import { subscribeToFlightInvites } from "@/lib/flight-invites";
import { requestNotificationPermission, showBrowserNotification } from "@/lib/notifications";

export function NotificationHub() {
  const currentUsername = useAuthStore((s) => s.currentUsername);
  const { add } = useToastStore();

  // Hangi konuşmada kaç mesaj gördük → sadece yenileri bildir
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  // Hangi davetleri gördük
  const seenInviteIdsRef = useRef<Set<string>>(new Set());
  // Sayfa yüklenme anı — önceki mesajları bildirim olarak gösterme
  const mountedAtRef = useRef(Date.now());

  // Mesaj dinleyicileri: arkadaş → unsub fonksiyonu
  const msgSubsRef = useRef<Map<string, () => void>>(new Map());

  // Bildirimlere izin iste
  useEffect(() => {
    if (currentUsername) requestNotificationPermission();
  }, [currentUsername]);

  // Arkadaş listesini dinle, her arkadaş için mesaj aboneliği aç
  useEffect(() => {
    if (!currentUsername) return;

    const unsubFriends = subscribeToFriends(currentUsername, (friends) => {
      const friendNames = friends.map((f) => f.username);

      // Eski arkadaşların aboneliklerini kapat
      msgSubsRef.current.forEach((unsub, name) => {
        if (!friendNames.includes(name)) {
          unsub();
          msgSubsRef.current.delete(name);
        }
      });

      // Yeni arkadaşlar için abone ol
      friendNames.forEach((friendName) => {
        if (msgSubsRef.current.has(friendName)) return;

        const unsub = subscribeToMessages(currentUsername, friendName, (msgs) => {
          msgs.forEach((msg) => {
            // Kendi mesajlarını atlا
            if (msg.from !== friendName) return;
            // Sayfa yüklenme öncesindeki mesajları atla
            if (msg.timestamp < mountedAtRef.current + 2000) return;
            // Daha önce gösterilenleri atla
            if (msg.id && seenMsgIdsRef.current.has(msg.id)) return;
            if (msg.id) seenMsgIdsRef.current.add(msg.id);

            // Toast göster
            add({
              type: "message",
              from: friendName,
              preview: msg.text,
              timestamp: msg.timestamp,
            });

            // Tarayıcı bildirimi
            showBrowserNotification(`✈ ${friendName}`, msg.text);
          });
        });

        msgSubsRef.current.set(friendName, unsub);
      });
    });

    return () => {
      unsubFriends();
      msgSubsRef.current.forEach((unsub) => unsub());
      msgSubsRef.current.clear();
    };
  }, [currentUsername, add]);

  // Uçuş davetlerini dinle
  useEffect(() => {
    if (!currentUsername) return;

    const unsubInvites = subscribeToFlightInvites(currentUsername, (invites) => {
      invites.forEach((invite) => {
        if (invite.timestamp < mountedAtRef.current + 2000) return;
        if (seenInviteIdsRef.current.has(invite.id)) return;
        seenInviteIdsRef.current.add(invite.id);

        const preview = `${invite.departure.name} → ${invite.destination.name} · ${invite.durationOption.label}`;

        add({
          type: "invite",
          from: invite.from,
          preview,
          timestamp: invite.timestamp,
        });

        showBrowserNotification(
          `✈ ${invite.from} uçuşa davet etti`,
          preview
        );
      });
    });

    return unsubInvites;
  }, [currentUsername, add]);

  return null; // Görsel çıktı yok
}
