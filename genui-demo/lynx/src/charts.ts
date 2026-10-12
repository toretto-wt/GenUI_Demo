import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import { arc, line, pie, stack, stackOffsetDiverging } from "d3-shape";

export const colors = [
  "#158b78",
  "#e09635",
  "#6486d9",
  "#cf658d",
  "#87963e",
  "#9375b9",
];
export type SeriesData = { category: string; values: number[] };
export type SliceData = { category: string; value: number };
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
const finite = (value: number) => (Number.isFinite(value) ? value : 0);
const short = (value: number) =>
  Math.abs(value) >= 1e6
    ? `${+(value / 1e6).toFixed(1)}M`
    : Math.abs(value) >= 1000
      ? `${+(value / 1000).toFixed(1)}k`
      : `${+value.toFixed(1)}`;
const svg = (width: number, height: number, body: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`)}`;
const text = (
  x: number,
  y: number,
  label: unknown,
  fill: string,
  anchor = "middle",
) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial,sans-serif" font-size="12" text-anchor="${anchor}">${escape(label)}</text>`;

export function cartesianChart(
  kind: "bar" | "line",
  labels: string[],
  series: SeriesData[],
  width: number,
  dark: boolean,
  stacked = false,
): string {
  const height = 252,
    left = 44,
    right = width - 12,
    top = 12,
    bottom = 216;
  const ink = dark ? "#b5c3c7" : "#58656c",
    grid = dark ? "#354348" : "#e5eaec";
  const values = labels.map((_, index) =>
    series.map((item) => finite(item.values[index] ?? 0)),
  );
  const layers = stack<number[]>()
    .keys(series.map((_, i) => String(i)))
    .value((row, key) => row[+key])
    .offset(stackOffsetDiverging)(values);
  const extents = stacked
    ? layers.flatMap((layer) => layer.flat())
    : values.flat();
  const min = Math.min(0, ...extents),
    max = Math.max(0, ...extents);
  const y = scaleLinear()
    .domain([min, max === min ? min + 1 : max])
    .nice()
    .range([bottom, top]);
  let body = y
    .ticks(4)
    .map(
      (tick) =>
        `<path d="M${left} ${y(tick)}H${right}" stroke="${grid}"/>${text(left - 7, y(tick) + 4, short(tick), ink, "end")}`,
    )
    .join("");
  const indices = labels.map((_, i) => String(i));
  const bands = scaleBand().domain(indices).range([left, right]).padding(0.24);
  const points = scalePoint()
    .domain(indices)
    .range([left + 8, right - 8])
    .padding(0.25);
  const x = (i: number) =>
    kind === "bar"
      ? bands(String(i))! + bands.bandwidth() / 2
      : points(String(i))!;
  const every = Math.max(
    1,
    Math.ceil(labels.length / Math.max(2, Math.floor((right - left) / 65))),
  );
  body += labels
    .map((label, i) =>
      i % every
        ? ""
        : text(
            x(i),
            bottom + 24,
            label.length > 10 ? `${label.slice(0, 9)}...` : label,
            ink,
          ),
    )
    .join("");
  series.forEach((item, s) => {
    const color = colors[s % colors.length];
    if (kind === "line") {
      const path = line<number>()
        .x((_, i) => x(i))
        .y((value) => y(finite(value)))(
        labels.map((_, i) => item.values[i] ?? 0),
      );
      body += `<path d="${path ?? ""}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
      body += labels
        .map(
          (_, i) =>
            `<circle cx="${x(i)}" cy="${y(finite(item.values[i] ?? 0))}" r="3.5" fill="${color}"/>`,
        )
        .join("");
    } else {
      labels.forEach((_, i) => {
        const value = finite(item.values[i] ?? 0);
        const [a, b] = stacked ? layers[s][i] : [0, value];
        const w =
          bands.bandwidth() / (stacked ? 1 : Math.max(1, series.length));
        body += `<rect x="${bands(String(i))! + (stacked ? 0 : s * w)}" y="${Math.min(y(a), y(b))}" width="${Math.max(1, w - 2)}" height="${Math.abs(y(a) - y(b))}" rx="2" fill="${color}"/>`;
      });
    }
  });
  return svg(width, height, body);
}

export function pieChart(
  slices: SliceData[],
  donut: boolean,
  width: number,
  dark: boolean,
): string {
  const height = 252,
    radius = 108;
  const arcs = pie<SliceData>()
    .sort(null)
    .value((slice) => Math.max(0, finite(slice.value)))(slices);
  const path = arc<(typeof arcs)[number]>()
    .innerRadius(donut ? 72 : 0)
    .outerRadius(radius)
    .padAngle(0.025);
  let body = `<g transform="translate(${width / 2},126)">${arcs.map((item, i) => `<path d="${path(item)}" fill="${colors[i % colors.length]}"/>`).join("")}</g>`;
  const total = slices.reduce(
    (sum, item) => sum + Math.max(0, finite(item.value)),
    0,
  );
  if (donut)
    body +=
      text(width / 2, 120, "Total", dark ? "#b5c3c7" : "#58656c") +
      text(width / 2, 142, short(total), dark ? "#f0f5f6" : "#203039");
  if (!total)
    body += text(width / 2, 180, "No data", dark ? "#b5c3c7" : "#58656c");
  return svg(width, height, body);
}
