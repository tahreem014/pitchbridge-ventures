import type { ProposalStatus } from "@/lib/portfolio";

// Shared look for the Portfolio (investor) and Analytics (founder) charts.

export const ACCENT = "hsl(158 75% 36%)";
export const AXIS = "hsl(var(--muted-foreground))";
export const GRID = "hsl(var(--border))";
export const TOOLTIP_STYLE = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 };

// With no data the line sits at zero; a little room below it keeps the line from being clipped by the chart edge.
export const ZERO_LINE_DOMAIN: [number, number] = [-1, 4];
export const AUTO_DOMAIN: [number, "auto"] = [0, "auto"];

export const STATUS_COLORS: Record<ProposalStatus, string> = {
  pending: "hsl(38 92% 50%)",
  countered: "hsl(210 80% 52%)",
  accepted: ACCENT,
  rejected: "hsl(0 72% 51%)",
  withdrawn: "hsl(220 9% 60%)",
};

export const CATEGORY_COLORS = ["hsl(158 75% 36%)", "hsl(230 55% 32%)", "hsl(200 75% 45%)", "hsl(38 92% 50%)", "hsl(280 50% 52%)", "hsl(220 9% 60%)"];
