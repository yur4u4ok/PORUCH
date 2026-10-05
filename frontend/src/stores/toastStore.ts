import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, tone?: ToastTone, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, tone = "info", durationMs = 4000) => {
    const id = nextId++;
    set((state) => ({
      toasts: [...state.toasts.filter((t) => t.message !== message), { id, message, tone }],
    }));
    window.setTimeout(() => get().dismiss(id), durationMs);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (message: string) => useToastStore.getState().show(message, "info"),
  success: (message: string) => useToastStore.getState().show(message, "success"),
  error: (message: string) => useToastStore.getState().show(message, "error", 6000),
};
