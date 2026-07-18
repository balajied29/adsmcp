/**
 * Minimal Meta Graph API client: version + token injection, typed GET/POST,
 * cursor pagination, and error mapping. The access token is sent as an
 * Authorization header (never in URLs) and redacted from all error output.
 */

const MAX_PAGES = 5;

export interface GraphErrorBody {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  fbtrace_id?: string;
}

export class GraphApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: number | undefined,
    readonly subcode: number | undefined,
    readonly fbtraceId: string | undefined,
    readonly usageInfo: string | undefined,
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

interface Paging {
  cursors?: { before?: string; after?: string };
  next?: string;
}

export interface Page<T> {
  data: T[];
  paging?: Paging;
}

export class GraphClient {
  private readonly baseUrl: string;

  constructor(
    private readonly accessToken: string,
    readonly apiVersion: string,
  ) {
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
  }

  /** Remove the token from any string that might surface in errors or logs. */
  redact(text: string): string {
    return text.split(this.accessToken).join("<REDACTED_TOKEN>");
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, "")}`);
    let body: string | undefined;

    if (method === "GET") {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    } else {
      body = new URLSearchParams(params).toString();
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(body !== undefined && {
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        },
        body,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new GraphApiError(
        `Network error calling the Graph API: ${this.redact(detail)}`,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    }

    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      throw this.toError(response, json);
    }
    return json as T;
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, params);
  }

  post<T>(path: string, params: Record<string, string>): Promise<T> {
    return this.request<T>("POST", path, params);
  }

  /** GET a list endpoint, following cursor pagination up to MAX_PAGES pages. */
  async getAll<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T[]> {
    const results: T[] = [];
    let after: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const pageParams = { ...params, ...(after && { after }) };
      const res = await this.get<Page<T>>(path, pageParams);
      results.push(...(res.data ?? []));
      // Refetch with the `after` cursor rather than following paging.next,
      // so the token stays in the Authorization header and out of URLs.
      after = res.paging?.next ? res.paging?.cursors?.after : undefined;
      if (!after) break;
    }
    return results;
  }

  private toError(response: Response, json: unknown): GraphApiError {
    const err: GraphErrorBody =
      json && typeof json === "object" && "error" in json
        ? ((json as { error: GraphErrorBody }).error ?? {})
        : {};

    const code = err.code;
    const rawMessage = err.error_user_msg || err.message || response.statusText;
    const usageInfo =
      response.headers.get("x-business-use-case-usage") ??
      response.headers.get("x-ad-account-usage") ??
      response.headers.get("x-app-usage") ??
      undefined;

    let hint = "";
    if (code === 190 || response.status === 401) {
      hint =
        " The access token is invalid or expired. Generate a fresh long-lived token " +
        "(Graph API Explorer or the token-exchange endpoint) and update META_ACCESS_TOKEN.";
    } else if (code === 10 || (code !== undefined && code >= 200 && code <= 299)) {
      hint =
        " Permission denied. The token must carry the ads_read and ads_management scopes, " +
        "and your user must have a role on this ad account.";
    } else if (
      code === 4 ||
      code === 17 ||
      code === 32 ||
      code === 613 ||
      code === 80000 ||
      code === 80004
    ) {
      hint =
        " Rate limited by Meta. Wait a few minutes before retrying." +
        (usageInfo ? ` Usage (x-business-use-case-usage): ${usageInfo}` : "");
    }

    return new GraphApiError(
      this.redact(
        `Graph API error ${response.status}${code !== undefined ? ` (code ${code}${err.error_subcode ? `/${err.error_subcode}` : ""})` : ""}: ${rawMessage}.${hint}${err.fbtrace_id ? ` [fbtrace_id: ${err.fbtrace_id}]` : ""}`,
      ),
      response.status,
      code,
      err.error_subcode,
      err.fbtrace_id,
      usageInfo,
    );
  }
}
