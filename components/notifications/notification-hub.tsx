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
import { subscribeToFriends, subscribeToIncomingRequests } from "@/lib/friends";
import { subscribeToMessages } from "@/lib/messages";
import { subscribeToFlightInvites } from "@/lib/flight-invites";
import { subscribeToUserGroups, subscribeToGroupMessages } from "@/lib/groups";
import { requestNotificationPermission, showBrowserNotification } from "@/lib/notifications";

export function NotificationHub() {
  const currentUsername = useAuthStore((s) => s.currentUsername);
  const { add } = useToastStore();

  // Hangi mesajları gördük → sadece yenileri bildir
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  // Hangi davetleri gördük
  const seenInviteIdsRef = useRef<Set<string>>(new Set());
  // Hangi arkadaşlık isteklerini gördük
  const seenReqsRef = useRef<Set<string>>(new Set());
  // Grup mesaj ID'leri
  const seenGroupMsgIdsRef = useRef<Set<string>>(new Set());

  // Mesaj dinleyicileri: arkadaş → unsub fonksiyonu
  const msgSubsRef = useRef<Map<string, () => void>>(new Map());
  // Grup mesaj dinleyicileri: groupId → unsub
  const groupSubsRef = useRef<Map<string, () => void>>(new Map());

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

        // initialized flag — ilk callback sadece seenIds'i doldurur, bildirim göstermez
        let initialized = false;

        const unsub = subscribeToMessages(currentUsername, friendName, (msgs) => {
          if (!initialized) {
            msgs.forEach((msg) => { if (msg.id) seenMsgIdsRef.current.add(msg.id); });
            initialized = true;
            return;
          }

          msgs.forEach((msg) => {
            if (msg.from !== friendName) return;
            if (msg.id && seenMsgIdsRef.current.has(msg.id)) return;
            if (msg.id) seenMsgIdsRef.current.add(msg.id);

            add({
              type: "message",
              from: friendName,
              preview: msg.text,
              timestamp: msg.timestamp,
            });
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

    let initialized = false;

    const unsubInvites = subscribeToFlightInvites(currentUsername, (invites) => {
      if (!initialized) {
        invites.forEach((inv) => seenInviteIdsRef.current.add(inv.id));
        initialized = true;
        return;
      }

      invites.forEach((invite) => {
        if (seenInviteIdsRef.current.has(invite.id)) return;
        seenInviteIdsRef.current.add(invite.id);

        const preview = `${invite.departure.name} → ${invite.destination.name} · ${invite.durationOption.label}`;

        add({
          type: "invite",
          from: invite.from,
          preview,
          timestamp: invite.timestamp,
        });

        showBrowserNotification(`✈ ${invite.from} uçuşa davet etti`, preview);
      });
    });

    return unsubInvites;
  }, [currentUsername, add]);

  // Arkadaşlık isteklerini dinle
  useEffect(() => {
    if (!currentUsername) return;

    let initialized = false;

    const unsubReqs = subscribeToIncomingRequests(currentUsername, (reqs) => {
      if (!initialized) {
        reqs.forEach((req) => seenReqsRef.current.add(req.from));
        initialized = true;
        return;
      }

      reqs.forEach((req) => {
        if (seenReqsRef.current.has(req.from)) return;
        seenReqsRef.current.add(req.from);

        add({
          type: "friend_request",
          from: req.from,
          preview: "Seni arkadaş listesine eklemek istiyor",
          timestamp: req.timestamp,
        });
        showBrowserNotification(`🤝 ${req.from}`, "Arkadaşlık isteği gönderdi");
      });
    });

    return unsubReqs;
  }, [currentUsername, add]);

  // Grup mesajlarını dinle
  useEffect(() => {
    if (!currentUsername) return;

    const unsubGroups = subscribeToUserGroups(currentUsername, (groups) => {
      const groupIds = groups.map((g) => g.id);

      // Eski grupların aboneliklerini kapat
      groupSubsRef.current.forEach((unsub, id) => {
        if (!groupIds.includes(id)) { unsub(); groupSubsRef.current.delete(id); }
      });

      // Yeni gruplar için abone ol
      groups.forEach((group) => {
        if (groupSubsRef.current.has(group.id)) return;

        let initialized = false;

        const unsub = subscribeToGroupMessages(group.id, (msgs) => {
          if (!initialized) {
            msgs.forEach((msg) => seenGroupMsgIdsRef.current.add(msg.id));
            initialized = true;
            return;
          }

          msgs.forEach((msg) => {
            if (msg.from === currentUsername) return;
            if (seenGroupMsgIdsRef.current.has(msg.id)) return;
            seenGroupMsgIdsRef.current.add(msg.id);

            add({
              type: "message",
              from: `${group.name} › ${msg.from}`,
              preview: msg.text,
              timestamp: msg.timestamp,
            });
            showBrowserNotification(`👥 ${group.name}`, `${msg.from}: ${msg.text}`);
          });
        });

        groupSubsRef.current.set(group.id, unsub);
      });
    });

    return () => {
      unsubGroups();
      groupSubsRef.current.forEach((unsub) => unsub());
      groupSubsRef.current.clear();
    };
  }, [currentUsername, add]);

  return null; // Görsel çıktı yok
}
