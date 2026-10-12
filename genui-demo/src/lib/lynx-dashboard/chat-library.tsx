"use client";

import Alert from "@mui/material/Alert";
import { useMessage, useThread } from "@openuidev/react-headless";
import {
  createLibrary,
  useTriggerAction,
  type ComponentRenderProps,
} from "@openuidev/react-lang";
import { useColorMode } from "@/hooks/use-system-theme";
import { usesLynxDashboard } from "@/lib/chat-starters";
import { muiChatLibrary } from "@/lib/mui-genui";
import { LynxDashboard } from "./host";
import { openUiContent } from "./response";
import { useDashboardStreamStatus } from "./stream-status";

const MuiCard = muiChatLibrary.components.Card.component;

function ReportCard(props: ComponentRenderProps) {
  const { message } = useMessage();
  const { messages, isRunning } = useThread();
  const { mode } = useColorMode();
  const triggerAction = useTriggerAction();
  const messageIndex = messages.findIndex((item) => item.id === message.id);
  const owner =
    messages.slice(0, messageIndex).findLast((item) => item.role === "user")
      ?.id ?? message.id;
  const status = useDashboardStreamStatus(owner);
  if (!usesLynxDashboard(messages, message.id)) return <MuiCard {...props} />;

  const interrupted =
    status === "interrupted" || (!isRunning && status !== "complete");
  const content =
    "content" in message && typeof message.content === "string"
      ? openUiContent(message.content)
      : "";
  return (
    <>
      {interrupted ? (
        <Alert severity="warning">
          Report generation was interrupted. Please regenerate the response.
        </Alert>
      ) : null}
      <LynxDashboard
        response={interrupted ? null : content}
        isStreaming={!interrupted && (status !== "complete" || isRunning)}
        mode={mode}
        onFollowUp={(text) => {
          if (!isRunning && status === "complete") void triggerAction(text);
        }}
      />
    </>
  );
}

// Preserve the SDK's message/state/action handling and every existing MUI renderer.
// Only the report root delegates its accumulated source to a ReactLynx runtime.
export const chatLibrary = createLibrary({
  root: muiChatLibrary.root,
  componentGroups: muiChatLibrary.componentGroups,
  components: Object.values(muiChatLibrary.components).map((definition) =>
    definition.name === "Card"
      ? { ...definition, component: ReportCard }
      : definition,
  ),
});
