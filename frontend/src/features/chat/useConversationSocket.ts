/**
 * Realtime conversation channel over WebSocket with automatic reconnect (exponential backoff),
 * heartbeat, offline awareness and refetch-after-reconnect to fill gaps.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { refreshSession } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Message } from "@/types/api";

import { markMessagesRead, upsertMessage, type MessagesData } from "./hooks";

export type SocketStatus = "connecting" | "open" | "reconnecting" | "offline";

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

export function socketUrl(conversationId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/conversations/${conversationId}/`;
}

export function useConversationSocket(conversationId: string, myId: string | undefined) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const typingTimer = useRef<number | undefined>(undefined);

  const send = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }, []);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | undefined;
    let heartbeat: number | undefined;
    const key = queryKeys.messages(conversationId);

    const handleEvent = (event: string, payload: Record<string, unknown>) => {
      switch (event) {
        case "message.created": {
          const message = payload as unknown as Message;
          qc.setQueryData<MessagesData>(key, (data) => upsertMessage(data, message));
          void qc.invalidateQueries({ queryKey: queryKeys.conversations });
          if (message.sender_id !== myId) setOtherTyping(false);
          break;
        }
        case "message.read":
          // Applies both to my messages read by the other side and to incoming ones I just read.
          qc.setQueryData<MessagesData>(key, (data) =>
            markMessagesRead(data, payload.message_ids as string[], payload.read_at as string),
          );
          if (payload.reader_id === myId) void qc.invalidateQueries({ queryKey: queryKeys.conversations });
          break;
        case "typing.started":
        case "typing.stopped":
          if (payload.user_id !== myId) {
            setOtherTyping(event === "typing.started");
            window.clearTimeout(typingTimer.current);
            if (event === "typing.started")
              typingTimer.current = window.setTimeout(() => setOtherTyping(false), 6000);
          }
          break;
        case "user.online":
        case "user.offline":
          if (payload.user_id !== myId) setOtherOnline(event === "user.online");
          break;
      }
    };

    const connect = () => {
      if (disposed) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      setStatus(attemptsRef.current === 0 ? "connecting" : "reconnecting");
      const socket = new WebSocket(socketUrl(conversationId));
      socketRef.current = socket;

      socket.onopen = () => {
        const wasReconnect = attemptsRef.current > 0;
        attemptsRef.current = 0;
        setStatus("open");
        heartbeat = window.setInterval(() => send({ type: "ping" }), HEARTBEAT_MS);
        // Fill any gap that happened while disconnected.
        if (wasReconnect) void qc.invalidateQueries({ queryKey: key });
      };
      socket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string) as { event: string; payload?: Record<string, unknown> };
          handleEvent(data.event, data.payload ?? {});
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = async (event) => {
        window.clearInterval(heartbeat);
        socketRef.current = null;
        if (disposed) return;
        setOtherOnline(false);
        // 4403 = not allowed (e.g. expired access cookie) → refresh session once before retrying.
        if (event.code === 4403 && attemptsRef.current === 0) await refreshSession();
        attemptsRef.current += 1;
        setStatus(navigator.onLine ? "reconnecting" : "offline");
        const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(attemptsRef.current, 5));
        reconnectTimer = window.setTimeout(connect, delay + Math.random() * 300);
      };
    };

    const onOnline = () => {
      window.clearTimeout(reconnectTimer);
      attemptsRef.current = Math.max(attemptsRef.current, 1);
      connect();
    };
    const onOffline = () => {
      setStatus("offline");
      socketRef.current?.close();
    };

    connect();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeat);
      window.clearTimeout(typingTimer.current);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      socketRef.current?.close();
    };
  }, [conversationId, myId, qc, send]);

  const notifyTyping = useCallback(
    (typing: boolean) => send({ type: typing ? "typing.started" : "typing.stopped" }),
    [send],
  );

  return { status, otherTyping, otherOnline, notifyTyping };
}
