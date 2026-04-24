"use client";
import { create } from "zustand";

export type ToastType =
  | "message"
  | "invite"
  | "friend_accepted"
  | "friend_request"
  | "group_invite";

export interface AppToast {
  id: string;
  type: ToastType;
  from: string;
  preview: string;
  timestamp: number;
  /** group_invite için grup bilgileri */
  meta?: { groupId: string; groupName: string };
}

interface ToastState {
  toasts: AppToast[];
  add: (t: Omit<AppToast, "id">) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (t) =>
    set((s) => ({
      toasts: [
        ...s.toasts.slice(-3),
        { ...t, id: Math.random().toString(36).slice(2, 9) },
      ],
    })),
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
