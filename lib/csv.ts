import type { ChartSpec } from "./executor";

/** CSV of the answer's data (year per row, one column per figure), with a UTF-8 BOM so Excel shows ə, ş, ğ. */
export function toCsv(chart: ChartSpec, yearLabel: string): string {
  const years = [...new Set(chart.series.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
  const esc = (x: string) => (/[",\n;]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const head = [yearLabel, ...chart.series.map((s) => `${s.label} (${chart.unit})`)].map(esc).join(",");
  const rows = years.map((y) => [String(y), ...chart.series.map((s) => String(s.points.find((p) => p.year === y)?.value ?? ""))].join(","));
  return "﻿" + [head, ...rows].join("\n") + "\n";
}

export function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
