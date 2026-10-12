"use client";

import {
  agUIAdapter,
  type ChatLLM,
  type StreamProtocolAdapter,
} from "@openuidev/react-headless";
import { useSyncExternalStore } from "react";

type Status = "streaming" | "complete" | "interrupted";
const statuses = new Map<string, Status>();
const listeners = new Set<() => void>();
const responseOwners = new WeakMap<Response, string>();
export const getDashboardStreamStatus = (id: string) => statuses.get(id);
function setStatus(id: string, status: Status) {
  statuses.set(id, status);
  listeners.forEach((notify) => notify());
}

export function dashboardStreamAdapter(): StreamProtocolAdapter {
  const adapter = agUIAdapter();
  return {
    async *parse(response) {
      const pending = new Set<string>();
      const owner = responseOwners.get(response);
      try {
        for await (const event of adapter.parse(response)) {
          if (event.type === "TEXT_MESSAGE_START") {
            const id = owner ?? event.messageId;
            pending.add(id);
            setStatus(id, "streaming");
          } else if (event.type === "TEXT_MESSAGE_END") {
            const id = owner ?? event.messageId;
            pending.delete(id);
            setStatus(id, "complete");
          } else if (event.type === "RUN_ERROR") {
            pending.forEach((id) => setStatus(id, "interrupted"));
          }
          yield event;
        }
      } finally {
        // EOF, Abort, and [DONE] alone are not successful completion.
        pending.forEach((id) => setStatus(id, "interrupted"));
      }
    },
  };
}

export function withDashboardStreamStatus(llm: ChatLLM): ChatLLM {
  return {
    ...llm,
    streamProtocol: dashboardStreamAdapter(),
    async send(input) {
      // The chat SDK creates its own assistant IDs instead of retaining AG-UI IDs.
      const owner = input.messages.findLast(
        (message) => message.role === "user",
      )?.id;
      const response = await llm.send(input);
      if (owner) responseOwners.set(response, owner);
      return response;
    },
  };
}

export function useDashboardStreamStatus(id: string) {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    () => getDashboardStreamStatus(id),
    () => undefined,
  );
}
