import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createParser, createStreamingParser } from "@openuidev/lang-core";
import {
  chatStarters,
  STARTUP_PROMPT,
  usesLynxDashboard,
} from "../src/lib/chat-starters";
import { dashboardLibrary } from "../src/lib/lynx-dashboard/contract";
import { openUiContent } from "../src/lib/lynx-dashboard/response";
import {
  dashboardStreamAdapter,
  getDashboardStreamStatus,
  withDashboardStreamStatus,
} from "../src/lib/lynx-dashboard/stream-status";
import { cartesianChart, pieChart } from "../lynx/src/charts";

const fixture = readFileSync(
  new URL("./fixtures/startup.openui", import.meta.url),
  "utf8",
);
test("startup and its follow-ups route to Lynx, other starters stay MUI", () => {
  const history = [
    { role: "system", content: "instructions" },
    { role: "user", content: [{ type: "text", text: STARTUP_PROMPT }] },
    { id: "a", role: "assistant", content: fixture },
    { role: "user", content: "Compare the prior quarter" },
  ];
  assert.equal(usesLynxDashboard(history), true);
  for (const starter of chatStarters.slice(1)) {
    const updated = [...history, { role: "user", content: starter.prompt }];
    assert.equal(usesLynxDashboard(updated), false);
    assert.equal(usesLynxDashboard(updated, "a"), true);
  }
  assert.equal(
    usesLynxDashboard([{ role: "user", content: "Show a dashboard" }]),
    false,
  );
});

test("Cloud envelopes and streaming marker fragments never enter the Lynx source", () => {
  assert.equal(openUiContent(fixture), fixture.trim());
  assert.equal(
    openUiContent(
      `]]>openui:content\n${fixture}]]>openui:context\n{}]]>openui:end`,
    ),
    fixture.trim(),
  );
  assert.equal(
    openUiContent(`]]>openui:content\n${fixture}]]>openui:con`),
    fixture.trim(),
  );
  assert.equal(openUiContent("]]>openui:content"), "");
  assert.equal(openUiContent("rows = [[1, 2]]"), "rows = [[1, 2]]");
  const cloudResponse = `]]>openui:content?thesys=true\n\`\`\`openui-lang\n${fixture}\`\`\`\n]]>openui:end`;
  const parsed = createParser(dashboardLibrary.toJSONSchema()).parse(
    openUiContent(cloudResponse),
  );
  assert.ok(parsed.root);
  assert.deepEqual(parsed.meta.errors, []);
});

test("shared library parses complete and chunked reports with identical root data", () => {
  const schema = dashboardLibrary.toJSONSchema();
  const result = createParser(schema).parse(fixture);
  assert.ok(result.root);
  assert.deepEqual(result.meta.errors, []);
  const streaming = createStreamingParser(schema);
  for (let i = 0; i < fixture.length; i += 23)
    streaming.push(fixture.slice(i, i + 23));
  assert.deepEqual(streaming.getResult().root, result.root);
  assert.ok(!("Form" in dashboardLibrary.components));
});

function stream(events: unknown[]) {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") +
      "data: [DONE]\n\n",
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
test("only TEXT_MESSAGE_END completes a report, not DONE, errors or cancellation", async () => {
  for (const [id, terminal, expected] of [
    ["ok", [{ type: "TEXT_MESSAGE_END", messageId: "ok" }], "complete"],
    ["eof", [], "interrupted"],
    [
      "error",
      [{ type: "RUN_ERROR", message: "Provider failed" }],
      "interrupted",
    ],
  ] as const) {
    const response = stream([
      { type: "TEXT_MESSAGE_START", messageId: id, role: "assistant" },
      ...terminal,
    ]);
    for await (const event of dashboardStreamAdapter().parse(response))
      assert.ok(event);
    assert.equal(getDashboardStreamStatus(id), expected);
  }
  for await (const event of dashboardStreamAdapter().parse(
    stream([
      { type: "TEXT_MESSAGE_START", messageId: "cancel", role: "assistant" },
    ]),
  )) {
    assert.ok(event);
    break;
  }
  assert.equal(getDashboardStreamStatus("cancel"), "interrupted");
});

test("stream completion remains attached to the user turn when SDK assistant IDs differ", async () => {
  const llm = withDashboardStreamStatus({
    streamProtocol: dashboardStreamAdapter(),
    send: async () =>
      stream([
        {
          type: "TEXT_MESSAGE_START",
          messageId: "server-id",
          role: "assistant",
        },
        { type: "TEXT_MESSAGE_END", messageId: "server-id" },
      ]),
  });
  const response = await llm.send({
    threadId: "thread",
    messages: [{ id: "user-turn", role: "user", content: STARTUP_PROMPT }],
    signal: new AbortController().signal,
  });
  for await (const event of llm.streamProtocol.parse(response))
    assert.ok(event);
  assert.equal(getDashboardStreamStatus("user-turn"), "complete");
});

test("chart geometry handles negative/empty data and escapes generated SVG labels", () => {
  for (const kind of ["bar", "line"] as const) {
    const svg = decodeURIComponent(
      cartesianChart(
        kind,
        ["<script>", "Feb"],
        [{ category: "Sales", values: [-3, 4] }],
        280,
        false,
        true,
      ),
    );
    assert.ok(!svg.includes("NaN"));
    assert.ok(svg.includes("&lt;script&gt;"));
    assert.ok(
      !decodeURIComponent(cartesianChart(kind, [], [], 280, true)).includes(
        "NaN",
      ),
    );
  }
  assert.ok(
    decodeURIComponent(pieChart([], true, 280, false)).includes("No data"),
  );
});
