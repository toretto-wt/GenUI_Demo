"use client";

import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import {
  AgentInterface,
  agUIAdapter,
  fetchLLM,
  openAIMessageFormat,
} from "@openuidev/react-ui";
import { useMemo } from "react";

import { useColorMode } from "@/hooks/use-system-theme";
import { chatStarters } from "@/lib/chat-starters";
import { chatLibrary } from "@/lib/lynx-dashboard/chat-library";
import { withDashboardStreamStatus } from "@/lib/lynx-dashboard/stream-status";

export default function Page() {
  const { mode, toggle } = useColorMode();

  const llm = useMemo(
    () =>
      withDashboardStreamStatus(
        fetchLLM({
          url: "/api/chat",
          streamAdapter: agUIAdapter(),
          messageFormat: openAIMessageFormat,
        }),
      ),
    [],
  );

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "fixed",
          top: 12,
          right: { xs: 64, sm: 16 },
          zIndex: 1300,
        }}
      >
        <Tooltip
          title={
            mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          <IconButton
            onClick={toggle}
            size="small"
            aria-label="Toggle color mode"
          >
            {mode === "dark" ? (
              <LightModeIcon fontSize="small" />
            ) : (
              <DarkModeIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <AgentInterface
        llm={llm}
        componentLibrary={chatLibrary}
        agentName="GenUI Chat"
        theme={{ mode }}
        starterVariant="short"
        starters={chatStarters}
      />
    </Box>
  );
}
