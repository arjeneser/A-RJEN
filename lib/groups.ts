import { ref, set, push, onValue, remove } from "firebase/database";
import { getDb } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  members: Record<string, true>;
  createdBy: string;
  createdAt: number;
  lastMessage?: { text: string; from: string; timestamp: number };
}

export interface GroupMessage {
  id: string;
  from: string;
  text: string;
  timestamp: number;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Yeni grup oluştur ve tüm üyelere index yaz */
export async function createGroup(
  name: string,
  members: string[],
  createdBy: string
): Promise<string> {
  const db = getDb();
  if (!db) return "";

  const groupRef = push(ref(db, "groups"));
  const groupId  = groupRef.key!;

  const membersObj: Record<string, true> = {};
  [...new Set([...members, createdBy])].forEach((m) => { membersObj[m] = true; });

  await set(ref(db, `groups/${groupId}`), {
    name,
    members: membersObj,
    createdBy,
    createdAt: Date.now(),
  });

  // Her üye için hızlı lookup index
  await Promise.all(
    Object.keys(membersObj).map((m) =>
      set(ref(db, `userGroups/${m}/${groupId}`), true)
    )
  );

  return groupId;
}

/** Gruba mesaj gönder + lastMessage önizlemesini güncelle */
export async function sendGroupMessage(
  groupId: string,
  from: string,
  text: string
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const msgRef = push(ref(db, `groupMessages/${groupId}`));
  await set(msgRef, {
    id: msgRef.key,
    from,
    text,
    timestamp: Date.now(),
  });

  await set(ref(db, `groups/${groupId}/lastMessage`), {
    text,
    from,
    timestamp: Date.now(),
  });
}

/** Gruptan ayrıl */
export async function leaveGroup(groupId: string, username: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await remove(ref(db, `groups/${groupId}/members/${username}`));
  await remove(ref(db, `userGroups/${username}/${groupId}`));
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/** Kullanıcının gruplarını gerçek zamanlı dinle */
export function subscribeToUserGroups(
  username: string,
  callback: (groups: Group[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};

  const userGroupsRef = ref(db, `userGroups/${username}`);
  const allGroupsRef  = ref(db, "groups");

  let myGroupIds: string[]          = [];
  let allGroupsData: Record<string, any> = {};

  const merge = () => {
    const groups: Group[] = myGroupIds
      .map((id) => {
        const g = allGroupsData[id];
        return g ? ({ ...g, id } as Group) : null;
      })
      .filter((g): g is Group => g !== null)
      .sort(
        (a, b) =>
          (b.lastMessage?.timestamp ?? b.createdAt) -
          (a.lastMessage?.timestamp ?? a.createdAt)
      );
    callback(groups);
  };

  const u1 = onValue(userGroupsRef, (snap) => {
    myGroupIds = snap.val() ? Object.keys(snap.val()) : [];
    merge();
  });

  const u2 = onValue(allGroupsRef, (snap) => {
    allGroupsData = snap.val() || {};
    merge();
  });

  return () => { u1(); u2(); };
}

/** Grup mesajlarını gerçek zamanlı dinle */
export function subscribeToGroupMessages(
  groupId: string,
  callback: (messages: GroupMessage[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};

  const r = ref(db, `groupMessages/${groupId}`);
  return onValue(r, (snap) => {
    const data = snap.val() as Record<string, GroupMessage> | null;
    const msgs = data
      ? Object.values(data).sort((a, b) => a.timestamp - b.timestamp)
      : [];
    callback(msgs);
  });
}
