import { appToolDeclarations, appToolExecutors } from "@/lib/app-tools";
import { cloudInstructions } from "@/lib/cloud-prompt";
import { usesLynxDashboard } from "@/lib/chat-starters";
import { dashboardLibrary } from "@/lib/lynx-dashboard/contract";
import { DEFAULT_MODEL, requiredEnv } from "@/lib/env";
import { runChatToolLoop } from "@/lib/tool-loop";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export async function POST(req: Request) {
  let input: { messages?: ChatCompletionMessageParam[] } | null;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const messages = input?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: { message: "messages must be a non-empty ChatCompletionMessageParam[]" } },
      { status: 400 },
    );
  }

  let client: OpenAI;
  let instructions: string;
  try {
    client = new OpenAI({
      baseURL: "https://api.thesys.dev/v1/embed",
      apiKey: requiredEnv("THESYS_API_KEY"),
    });
    instructions = usesLynxDashboard(messages)
      ? cloudInstructions(
          "Render this conversation with the supplied Lynx dashboard library only. Use Card as root. Include Revenue BarChart, Growth LineChart, and Breakdown PieChart in Tabs, a key metrics Table, annual goal Progress and FollowUpBlock. Use illustrative data if none is supplied and label it as sample data. Keep follow-up responses within this library. Do not use Query, Mutation, HTML, or Markdown code fences.",
          { ...dashboardLibrary.toSpec(), schema: dashboardLibrary.toJSONSchema() },
        )
      : cloudInstructions();
  } catch (err) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Chat is not configured." } },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const signal = AbortSignal.any([req.signal, abortController.signal]);
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (chunk: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };
      const messageId = crypto.randomUUID();
      let hasContent = false;
      try {
        await runChatToolLoop({
          client,
          model: DEFAULT_MODEL,
          messages: [{ role: "system", content: instructions }, ...messages],
          tools: appToolDeclarations,
          executors: appToolExecutors,
          enqueue: (chunk) => {
            if (signal.aborted) return;
            const content = chunk.choices[0]?.delta?.content;
            if (!content) return;
            if (!hasContent) {
              enqueue({ type: "TEXT_MESSAGE_START", messageId, role: "assistant" });
              hasContent = true;
            }
            enqueue({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: content });
          },
          signal,
        });
        if (!signal.aborted) {
          if (!hasContent) throw new Error("The model returned an empty response. Please try again.");
          enqueue({ type: "TEXT_MESSAGE_END", messageId });
        }
      } catch (err) {
        if (!signal.aborted) {
          let message = err instanceof Error ? err.message : "Unable to generate a response.";
          if (err instanceof OpenAI.APIError) {
            if (err.status === 401 || err.status === 403) {
              message = "OpenUI Cloud authentication failed. Set a valid THESYS_API_KEY in .env.local and restart the dev server.";
            } else if (err.status === 429) {
              message = "OpenUI Cloud rate limit or quota exceeded. Check your API quota and try again.";
            }
          }
          enqueue({ type: "RUN_ERROR", message });
        }
      } finally {
        if (!cancelled) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
    },
    cancel() {
      cancelled = true;
      abortController.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
