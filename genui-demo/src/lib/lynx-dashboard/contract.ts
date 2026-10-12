import { createLibrary, defineComponent } from "@openuidev/lang-core";
import { z } from "zod";

// Headless schemas are shared by the Cloud prompt and the ReactLynx renderers.
function component<T extends z.ZodObject>(
  name: string,
  props: T,
  description: string,
) {
  return defineComponent({ name, props, description, component: () => null });
}

export const CardHeader = component(
  "CardHeader",
  z.object({ title: z.string(), description: z.string().optional() }),
  "Report title and subtitle.",
);
export const Heading = component(
  "Heading",
  z.object({
    text: z.string(),
    level: z.enum(["h1", "h2", "h3", "h4"]).optional(),
  }),
  "Section title.",
);
export const TextContent = component(
  "TextContent",
  z.object({
    text: z.string(),
    size: z
      .enum(["small", "default", "large", "small-heavy", "large-heavy"])
      .optional(),
  }),
  "Report commentary.",
);
export const Separator = component(
  "Separator",
  z.object({ orientation: z.enum(["horizontal", "vertical"]).optional() }),
  "Section divider.",
);
export const Series = component(
  "Series",
  z.object({ category: z.string(), values: z.array(z.number()) }),
  "Named series. Values align with chart labels.",
);
export const Slice = component(
  "Slice",
  z.object({ category: z.string(), value: z.number() }),
  "Named non-negative pie slice.",
);
export const BarChart = component(
  "BarChart",
  z.object({
    labels: z.array(z.string()),
    series: z.array(Series.ref),
    variant: z.enum(["grouped", "stacked"]).optional(),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
  }),
  "Revenue chart with grouped or stacked series.",
);
export const LineChart = component(
  "LineChart",
  z.object({
    labels: z.array(z.string()),
    series: z.array(Series.ref),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
  }),
  "Monthly growth trend with one or more series.",
);
export const PieChart = component(
  "PieChart",
  z.object({ slices: z.array(Slice.ref), donut: z.boolean().optional() }),
  "Traffic or revenue breakdown. Use donut=true for a ring chart.",
);
export const Col = component(
  "Col",
  z.object({
    header: z.string(),
    type: z.enum(["string", "number", "boolean"]).optional(),
  }),
  "Table column.",
);
export const Table = component(
  "Table",
  z.object({
    columns: z.array(Col.ref),
    rows: z.array(
      z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    ),
  }),
  "Key metrics table; rows align with columns.",
);
export const Progress = component(
  "Progress",
  z.object({ value: z.number(), label: z.string().optional() }),
  "Annual goal completion, 0-100 percent.",
);
export const FollowUpItem = component(
  "FollowUpItem",
  z.object({ text: z.string() }),
  "A suggested next user message.",
);
export const FollowUpBlock = component(
  "FollowUpBlock",
  z.object({ items: z.array(FollowUpItem.ref) }),
  "Follow-up suggestions at the end of the report.",
);
const content = z.union([
  CardHeader.ref,
  Heading.ref,
  TextContent.ref,
  Separator.ref,
  BarChart.ref,
  LineChart.ref,
  PieChart.ref,
  Table.ref,
  Progress.ref,
  FollowUpBlock.ref,
]);
export const TabItem = component(
  "TabItem",
  z.object({
    value: z.string(),
    trigger: z.string(),
    content: z.array(content),
  }),
  "Tab panel with a unique non-empty value, label, and content.",
);
export const Tabs = component(
  "Tabs",
  z.object({
    items: z.array(TabItem.ref),
    defaultValue: z.string().optional(),
  }),
  "Chart tabs. defaultValue must match an item's value.",
);
export const Card = component(
  "Card",
  z.object({ children: z.array(z.union([content, Tabs.ref])) }),
  "Root report container.",
);
export const dashboardDefinitions = [
  Card,
  CardHeader,
  Heading,
  TextContent,
  Separator,
  Series,
  Slice,
  BarChart,
  LineChart,
  PieChart,
  Col,
  Table,
  Progress,
  TabItem,
  Tabs,
  FollowUpItem,
  FollowUpBlock,
];
export const dashboardLibrary = createLibrary({
  root: "Card",
  components: dashboardDefinitions,
});

export type DashboardData = {
  response: string | null;
  isStreaming: boolean;
  mode: "light" | "dark";
  width: number;
};
