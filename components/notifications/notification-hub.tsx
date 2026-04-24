"use client";
/**
 * NotificationHub
 * ────────────────
 * Firebase'den gelen mesajları ve bildirimleri dinler,
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

  const seenMsgIdsRef       = useRef<Set<string>>(new Set());
  const seenInviteIdsRef    = useRef<Set<string>>(new Set());
  const seenReqsRef         = useRef<Set<string>>(new Set());
  const seenGroupMsgIdsRef  = useRef<Set<string>>(new Set());
  const seenGroupIdsRef     = useRef<Set<string>>(new Set()); // grup davetleri

  const msgSubsRef   = useRef<Map<string, () => void>>(new Map());
  const groupSubsRef = useRef<Map<string, () => void>>(new Map());

  // Bildirimlere izin iste
  useEffect(() => {
    if (currentUsername) requestNotificationPermission();
  }, [currentUsername]);

  // Arkadaş mesajları
  useEffect(() => {
    if (!currentUsername) return;

    const unsubFriends = subscribeToFriends(currentUsername, (friends) => {
      const friendNames = friends.map((f) => f.username);

      msgSubsRef.current.forEach((unsub, name) => {
        if (!friendNames.includes(name)) { unsub(); msgSubsRef.current.delete(name); }
      });

      friendNames.forEach((friendName) => {
        if (msgSubsRef.current.has(friendName)) return;
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
            add({ type: "message", from: friendName, preview: msg.text, timestamp: msg.timestamp });
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

  // Uçuş davetleri
  useEffect(() => {
    if (!currentUsername) return;
    let initialized = false;

    const unsub = subscribeToFlightInvites(currentUsername, (invites) => {
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
          meta: {
            inviteId: invite.id,
            departure: invite.departure,
            destination: invite.destination,
            durationOption: invite.durationOption,
            lobbyId: invite.lobbyId,
          },
        });
        showBrowserNotification(`✈ ${invite.from} uçuşa davet etti`, preview);
      });
    });

    return unsub;
  }, [currentUsername, add]);

  // Arkadaşlık istekleri
  useEffect(() => {
    if (!currentUsername) return;
    let initialized = false;

    const unsub = subscribeToIncomingRequests(currentUsername, (reqs) => {
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

    return unsub;
  }, [currentUsername, add]);

  // Grup davetleri + grup mesajları
  useEffect(() => {
    if (!currentUsername) return;
    let groupsInitialized = false;

    const unsubGroups = subscribeToUserGroups(currentUsername, (groups) => {
      const groupIds = groups.map((g) => g.id);

      // ── Grup daveti tespiti ──────────────────────────────────────────────────
      if (!groupsInitialized) {
        // İlk callback: mevcut grupları sessizce kaydet
        groups.forEach((g) => seenGroupIdsRef.current.add(g.id));
        groupsInitialized = true;
      } else {
        // Sonraki callbackler: yeni grup varsa ve kuranı biz değilsek → davet toast
        groups.forEach((g) => {
          if (seenGroupIdsRef.current.has(g.id)) return;
          seenGroupIdsRef.current.add(g.id);
          if (g.createdBy === currentUsername) return; // kendimiz kurduk

          add({
            type: "group_invite",
            from: g.createdBy,
            preview: `"${g.name}" adlı gruba eklendiniz`,
            timestamp: g.createdAt,
            meta: { groupId: g.id, groupName: g.name },
          });
          showBrowserNotification(
            `👥 ${g.createdBy} gruba ekledi`,
            `"${g.name}" adlı gruba katılmak ister misiniz?`
          );
        });
      }

      // ── Grup mesaj abonelikleri ──────────────────────────────────────────────
      groupSubsRef.current.forEach((unsub, id) => {
        if (!groupIds.includes(id)) { unsub(); groupSubsRef.current.delete(id); }
      });

      groups.forEach((group) => {
        if (groupSubsRef.current.has(group.id)) return;
        let msgInitialized = false;

        const unsub = subscribeToGroupMessages(group.id, (msgs) => {
          if (!msgInitialized) {
            msgs.forEach((msg) => seenGroupMsgIdsRef.current.add(msg.id));
            msgInitialized = true;
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

  return null;
}
