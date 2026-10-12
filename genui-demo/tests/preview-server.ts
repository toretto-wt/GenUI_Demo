// Local browser-test proxy. Uses the real API route with a fixture-only provider.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { POST } from "../src/app/api/chat/route";

const upstream = process.env.PREVIEW_UPSTREAM || "http://127.0.0.1:3001";
const port = Number(process.env.PREVIEW_PORT || 3101);
const fixture = readFileSync(
  new URL("./fixtures/startup.openui", import.meta.url),
  "utf8",
);
const nativeFetch = globalThis.fetch;
process.env.THESYS_API_KEY = "local-fixture-only";
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.startsWith("https://api.thesys.dev/"))
    return nativeFetch(input, init);
  const request = input instanceof Request ? input : new Request(input, init);
  const payload = await request.json();
  const latest = payload.messages.at(-1)?.content;
  const fail = latest === "Test interrupted report";
  console.log("Fixture request", {
    narrowLibrary: !payload.messages[0].content.includes('"Form"'),
    fail,
  });
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const content = `]]>openui:content\n${fixture}]]>openui:end`;
        for (let i = 0; i < content.length; i += 120) {
          if (request.signal.aborted) break;
          if (fail && i > content.length / 2) {
            controller.error(new Error("Fixture provider interrupted"));
            return;
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: content.slice(i, i + 120) }, finish_reason: null }] })}\n\n`,
            ),
          );
          await delay(latest === "Test slow report" ? 350 : 25);
        }
        controller.enqueue(
          encoder.encode(
            'data: {"id":"fixture","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
          ),
        );
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
};

createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const response =
      req.url === "/api/chat" && req.method === "POST"
        ? await POST(
            new Request(`http://127.0.0.1:${port}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            }),
          )
        : await nativeFetch(`${upstream}${req.url}`);
    res.writeHead(
      response.status,
      Object.fromEntries(
        [...response.headers].filter(
          ([name]) =>
            ![
              "content-encoding",
              "content-length",
              "transfer-encoding",
            ].includes(name),
        ),
      ),
    );
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    res.end();
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
}).listen(port, "127.0.0.1", () =>
  console.log(
    `Fixture preview http://127.0.0.1:${port} (upstream ${upstream})`,
  ),
);
