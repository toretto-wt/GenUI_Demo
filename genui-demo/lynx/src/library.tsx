import { useInitData, useState } from "@lynx-js/react";
import {
  createOpenUiLibrary,
  defineComponent,
  useIsStreaming,
  useTriggerAction,
  type ComponentRenderProps,
} from "@lynx-js/genui/openui/explicit";
import * as schema from "../../src/lib/lynx-dashboard/contract";
import {
  cartesianChart,
  colors,
  pieChart,
  type SeriesData,
  type SliceData,
} from "./charts";

function children<T>(items: unknown): T[] {
  return Array.isArray(items)
    ? items
        .filter((item) => item?.type === "element" && item.props)
        .map((item) => item.props as T)
    : [];
}

function Chart({
  kind,
  labels = [],
  series = [],
  slices = [],
  variant,
  donut,
  xLabel,
  yLabel,
}: {
  kind: "bar" | "line" | "pie";
  labels?: string[];
  series?: unknown;
  slices?: unknown;
  variant?: string;
  donut?: boolean;
  xLabel?: string;
  yLabel?: string;
}) {
  const data = useInitData() as schema.DashboardData;
  const width = Math.max(240, (data.width || 600) - 40);
  const items = children<SeriesData>(series).filter(
    (item) => item.category && Array.isArray(item.values),
  );
  const segments = children<SliceData>(slices).filter(
    (item) => item.category && Number.isFinite(item.value),
  );
  const legend = kind === "pie" ? segments : items;
  const src =
    kind === "pie"
      ? pieChart(segments, !!donut, width, data.mode === "dark")
      : cartesianChart(
          kind,
          labels,
          items,
          width,
          data.mode === "dark",
          variant === "stacked",
        );
  return (
    <view className="chart">
      {yLabel ? <text className="caption">{yLabel}</text> : null}
      <image
        src={src}
        mode="aspectFit"
        style={{ width: "100%", height: "252px" }}
        accessibility-label={
          kind === "pie"
            ? "Breakdown chart"
            : `${yLabel || kind} by ${xLabel || "period"}`
        }
      />
      {xLabel ? <text className="caption chart-axis">{xLabel}</text> : null}
      <view className="legend">
        {legend.map((item, i) => (
          <view className="legend-item" key={`${item.category}-${i}`}>
            <view
              className="swatch"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <text className="caption">
              {item.category}
              {"value" in item ? ` (${item.value})` : ""}
            </text>
          </view>
        ))}
      </view>
    </view>
  );
}

function ChartTabs({
  props,
  renderNode,
}: ComponentRenderProps<{ items: unknown; defaultValue?: string }>) {
  const [selected, setSelected] = useState<string | null>(null);
  const streaming = useIsStreaming();
  const items = children<{ value: string; trigger: string; content: unknown }>(
    props.items,
  ).filter((item) => item.value && item.trigger);
  const active =
    items.find((item) => item.value === selected) ??
    items.find((item) => item.value === props.defaultValue) ??
    items[0];
  return (
    <view className="tabs-section">
      <view className="tabs">
        {items.map((item) => (
          <view
            key={item.value}
            className={`tab ${active?.value === item.value ? "tab-active" : ""}`}
            accessibility-element
            accessibility-traits="button"
            accessibility-label={item.trigger}
            bindtap={() => {
              if (!streaming) setSelected(item.value);
            }}
          >
            <text className="tab-label">{item.trigger}</text>
          </view>
        ))}
      </view>
      <view className="tab-panel">
        {active ? renderNode(active.content) : null}
      </view>
    </view>
  );
}

function FollowUps({ items }: { items: unknown }) {
  const trigger = useTriggerAction();
  const streaming = useIsStreaming();
  return (
    <view className={`follow-ups ${streaming ? "disabled" : ""}`}>
      {children<{ text: string }>(items)
        .filter((item) => item.text)
        .map((item, i) => (
          <view
            key={i}
            className="follow-up"
            accessibility-element
            accessibility-traits="button"
            accessibility-label={item.text}
            bindtap={() => {
              if (!streaming) void trigger(item.text);
            }}
          >
            <text className="follow-up-label">{item.text}</text>
            <text className="follow-up-arrow">{"\u2192"}</text>
          </view>
        ))}
    </view>
  );
}

const renderers = [
  defineComponent({
    ...schema.Card,
    component: ({ props, renderNode }) => (
      <view className="report">{renderNode(props.children)}</view>
    ),
  }),
  defineComponent({
    ...schema.CardHeader,
    component: ({ props }) => (
      <view className="report-header">
        <text className="report-title">{props.title}</text>
        {props.description ? (
          <text className="muted">{props.description}</text>
        ) : null}
      </view>
    ),
  }),
  defineComponent({
    ...schema.Heading,
    component: ({ props }) => <text className="heading">{props.text}</text>,
  }),
  defineComponent({
    ...schema.TextContent,
    component: ({ props }) => (
      <text className={`body-text ${props.size || "default"}`}>
        {props.text}
      </text>
    ),
  }),
  defineComponent({
    ...schema.Separator,
    component: () => <view className="separator" />,
  }),
  defineComponent({
    ...schema.BarChart,
    component: ({ props }) => <Chart kind="bar" {...props} />,
  }),
  defineComponent({
    ...schema.LineChart,
    component: ({ props }) => <Chart kind="line" {...props} />,
  }),
  defineComponent({
    ...schema.PieChart,
    component: ({ props }) => <Chart kind="pie" {...props} />,
  }),
  defineComponent({ ...schema.Tabs, component: ChartTabs }),
  defineComponent({
    ...schema.Progress,
    component: ({ props }) => {
      const value = Number.isFinite(props.value)
        ? Math.max(0, Math.min(100, props.value))
        : 0;
      return (
        <view className="goal">
          <view className="goal-label">
            <text className="body-text">{props.label || "Annual goal"}</text>
            <text className="goal-value">{value}%</text>
          </view>
          <view className="progress-track">
            <view className="progress-value" style={{ width: `${value}%` }} />
          </view>
        </view>
      );
    },
  }),
  defineComponent({
    ...schema.Table,
    component: ({ props }) => {
      const columns = children<{ header: string; type?: string }>(
        props.columns,
      );
      return (
        <scroll-view scroll-orientation="horizontal" className="table-scroll">
          <view
            className="table"
            style={{ minWidth: `${Math.max(280, columns.length * 130)}px` }}
          >
            <view className="table-row table-head">
              {columns.map((col, i) => (
                <text key={i} className="table-cell table-heading">
                  {col.header}
                </text>
              ))}
            </view>
            {(props.rows ?? []).filter(Array.isArray).map((row, r) => (
              <view key={r} className="table-row">
                {columns.map((col, c) => (
                  <text
                    key={c}
                    className={`table-cell ${col.type === "number" ? "numeric" : ""}`}
                  >
                    {String(row[c] ?? "")}
                  </text>
                ))}
              </view>
            ))}
          </view>
        </scroll-view>
      );
    },
  }),
  defineComponent({
    ...schema.FollowUpBlock,
    component: ({ props }) => <FollowUps items={props.items} />,
  }),
];

export const library = createOpenUiLibrary({
  includeDefaultComponents: false,
  root: "Card",
  components: schema.dashboardDefinitions.map(
    (definition) =>
      renderers.find((item) => item.name === definition.name) ?? definition,
  ),
});
