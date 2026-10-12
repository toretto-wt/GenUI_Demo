// Cloud wraps OpenUI Lang in content/context envelopes. Context is not UI source.
export function openUiContent(raw: string): string {
  const marker = "]]>openui:content";
  const start = raw.indexOf(marker);
  let content = start < 0 ? raw : raw.slice(start + marker.length);
  if (start >= 0) {
    const newline = content.indexOf("\n");
    if (newline < 0) return "";
    content = content.slice(newline + 1);
  }
  const end = content.search(/\]\]>openui:(?:context|end)/);
  if (end >= 0) content = content.slice(0, end);
  // A marker can arrive across several SSE chunks.
  for (const token of ["]]>openui:context", "]]>openui:end"]) {
    for (let length = token.length - 1; length >= 3; length--) {
      if (content.endsWith(token.slice(0, length))) {
        content = content.slice(0, -length);
        break;
      }
    }
  }
  if (content.startsWith("<content>"))
    content = content.slice(9).split("</content>")[0];
  return content.trim();
}
