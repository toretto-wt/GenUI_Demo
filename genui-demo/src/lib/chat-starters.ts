export const STARTUP_PROMPT =
  "Build a startup analytics dashboard with a CardHeader, Tabs (Revenue BarChart, Growth LineChart, Breakdown PieChart), a key metrics Table, a progress bar toward the annual goal, and follow-ups.";

export const chatStarters = [
  { displayText: "Startup dashboard", prompt: STARTUP_PROMPT },
  {
    displayText: "Onboarding form",
    prompt:
      "Create an account onboarding form with an info Alert, then a Form containing inputs for name and email, a Select for plan, and a SwitchGroup for notification preferences. Add follow-ups.",
  },
  {
    displayText: "Project status",
    prompt:
      "Generate a project status report with a CardHeader, a warning Alert for blockers, a List of this week's tasks, an Accordion (Done, In progress, Blocked), and a BarChart of story points per engineer. Add follow-ups.",
  },
  {
    displayText: "Pricing comparison",
    prompt:
      "Show a pricing comparison with a CardHeader, a Table comparing three plans, a List of included features, and buttons to choose a plan. Add follow-ups.",
  },
  {
    displayText: "Chart showcase",
    prompt:
      "Build a 'Quarterly Report' with Tabs containing a grouped BarChart (revenue by region, 2 series), a LineChart (monthly active users, 2 series), and a donut PieChart (traffic sources, 4 slices). Below, add a summary Table and follow-ups.",
  },
];

const normalize = (text: string) => text.trim().replace(/\s+/g, " ");
type RoutingMessage = { id?: string; role: string; content?: unknown };

export function usesLynxDashboard(
  messages: readonly RoutingMessage[],
  throughMessageId?: string,
): boolean {
  let lynx = false;
  for (const message of messages) {
    if (message.role === "user") {
      const content =
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? message.content
                .filter((part) => part?.type === "text")
                .map((part) => part.text)
                .join("\n")
            : "";
      const starter = chatStarters.find(
        (item) => normalize(item.prompt) === normalize(content),
      );
      if (starter) lynx = starter.prompt === STARTUP_PROMPT;
    }
    if (throughMessageId && message.id === throughMessageId) break;
  }
  return lynx;
}
