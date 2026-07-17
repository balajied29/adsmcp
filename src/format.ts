/**
 * Shared helpers: budget unit conversion and compact tool results.
 * Meta returns budgets in the account currency's minor units (e.g. cents);
 * tools accept and return major currency units.
 */

export function minorToMajor(minor: string | number | undefined): number | undefined {
  if (minor === undefined || minor === null || minor === "") return undefined;
  const n = typeof minor === "string" ? Number(minor) : minor;
  if (Number.isNaN(n)) return undefined;
  return n / 100;
}

export function majorToMinor(major: number): string {
  return String(Math.round(major * 100));
}

/** JSON tool result in the shape the MCP SDK expects. */
export function jsonResult(value: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(value, null, 2) },
    ],
  };
}

export function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/** Drop undefined/null/empty values so tool output stays compact. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}
