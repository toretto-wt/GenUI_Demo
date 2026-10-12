"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { LynxViewElement } from "@lynx-js/web-core/client";
import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "./contract";

let runtime: Promise<void> | undefined;
function loadRuntime(): Promise<void> {
  if (customElements.get("lynx-view")) return Promise.resolve();
  if (!runtime) {
    runtime = new Promise<void>((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/lynx/runtime/static/css/client.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/lynx/runtime/static/js/client.js";
      const fail = () => {
        window.clearTimeout(timer);
        script.remove();
        link.remove();
        reject(new Error("Unable to load the Lynx runtime. Please retry."));
      };
      const timer = window.setTimeout(fail, 15000);
      script.onload = () => {
        window.clearTimeout(timer);
        if (customElements.get("lynx-view")) resolve();
        else fail();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch((error) => {
      runtime = undefined;
      throw error;
    });
  }
  return runtime;
}

export function LynxDashboard({
  response,
  isStreaming,
  mode,
  onFollowUp,
}: Omit<DashboardData, "width"> & { onFollowUp: (text: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<LynxViewElement | null>(null);
  const viewReady = useRef(false);
  const current = useRef({ response, isStreaming, mode, onFollowUp });
  current.current = { response, isStreaming, mode, onFollowUp };
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = container.current!;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const timeout = window.setTimeout(() => {
      if (!disposed)
        setError("Lynx report took too long to load. Please retry.");
    }, 20000);
    setReady(false);
    viewReady.current = false;
    setError(null);
    const data = (): DashboardData => ({
      response: current.current.response,
      isStreaming: current.current.isStreaming,
      mode: current.current.mode,
      width: Math.round(host.clientWidth),
    });
    void loadRuntime()
      .then(() => {
        if (disposed) return;
        const element = document.createElement("lynx-view") as LynxViewElement;
        element.style.cssText = "display:block;width:100%;min-height:180px";
        element.setAttribute("height", "auto");
        element.setAttribute("aria-label", "Startup analytics dashboard");
        element.initData = data();
        element.onNativeModulesCall = (name, payload, module) => {
          if (disposed || module !== "bridge") return;
          if (name === "ready") {
            window.clearTimeout(timeout);
            viewReady.current = true;
            element.updateData(data());
            setError(null);
            setReady(true);
          }
          if (name === "renderError") {
            window.clearTimeout(timeout);
            console.error("Lynx OpenUI render error:", payload?.message);
            setError(
              "Lynx could not render this response. Please regenerate the report.",
            );
          }
          if (
            name === "action" &&
            !current.current.isStreaming &&
            current.current.response &&
            payload?.type === "continue_conversation" &&
            typeof payload.humanFriendlyMessage === "string"
          ) {
            current.current.onFollowUp(payload.humanFriendlyMessage);
          }
        };
        element.addEventListener("error", () => {
          window.clearTimeout(timeout);
          if (!disposed)
            setError("Unable to load the Lynx report. Please retry.");
        });
        element.url = "/lynx/main.web.bundle";
        host.appendChild(element);
        view.current = element;
        let width = host.clientWidth;
        observer = new ResizeObserver(() => {
          if (host.clientWidth !== width) {
            width = host.clientWidth;
            if (viewReady.current) element.updateData(data());
          }
        });
        observer.observe(host);
      })
      .catch((cause: unknown) => {
        window.clearTimeout(timeout);
        if (!disposed)
          setError(
            cause instanceof Error ? cause.message : "Unable to load Lynx.",
          );
      });
    return () => {
      disposed = true;
      viewReady.current = false;
      window.clearTimeout(timeout);
      observer?.disconnect();
      view.current?.remove();
      view.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (viewReady.current)
      view.current?.updateData({
        response,
        isStreaming,
        mode,
        width: Math.round(container.current?.clientWidth ?? 600),
      });
  }, [response, isStreaming, mode]);

  return (
    <Box
      data-renderer="lynx"
      aria-busy={!ready || isStreaming}
      sx={{
        width: "100%",
        minWidth: 0,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      {error ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}
      {!ready && !error ? (
        <Box role="status" sx={{ p: 2, color: "text.secondary", fontSize: 14 }}>
          Loading report...
        </Box>
      ) : null}
      <div
        ref={container}
        style={{ width: "100%", display: error ? "none" : "block" }}
      />
    </Box>
  );
}
