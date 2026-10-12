import { root, useInitData, useEffect } from "@lynx-js/react";
import { OpenUiRenderer } from "@lynx-js/genui/openui/explicit";
import type { DashboardData } from "../../src/lib/lynx-dashboard/contract";
import { library } from "./library";
import "./styles.css";

function bridge(name: string, data: Record<string, unknown>) {
  NativeModules.bridge.call(name, data, () => {});
}

function App() {
  const data = useInitData() as DashboardData;
  useEffect(() => {
    bridge("ready", {});
  }, []);
  return (
    <view className={`dashboard ${data.mode === "dark" ? "dark" : "light"}`}>
      <OpenUiRenderer
        response={data.response ?? null}
        isStreaming={data.isStreaming ?? true}
        library={library}
        onAction={(action) => bridge("action", { ...action })}
        onError={(errors) => {
          if (!data.isStreaming && errors.length)
            bridge("renderError", {
              message: errors.map((error) => error.message).join("; "),
            });
        }}
      />
    </view>
  );
}

root.render(<App />);
