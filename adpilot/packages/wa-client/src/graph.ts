/**
 * Minimal WhatsApp Cloud API client: version + token injection, typed
 * GET/POST, and WA-specific error mapping. The access token is sent as an
 * Authorization header (never in URLs) and redacted from all error output.
 * Same shape as packages/meta-client/src/graph.ts by design — one pattern
 * for every Graph-API-flavored integration in the monorepo.
 */

export interface WaErrorBody {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  fbtrace_id?: string;
  error_data?: { details?: string };
}

export class WaApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: number | undefined,
    readonly subcode: number | undefined,
    readonly fbtraceId: string | undefined,
    /** True for errors the dispatcher should retry (throughput, transient 5xx). */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "WaApiError";
  }
}

export class WaClient {
  private readonly baseUrl: string;

  constructor(
    private readonly accessToken: string,
    readonly apiVersion: string,
  ) {
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
  }

  redact(text: string): string {
    return text.split(this.accessToken).join("<REDACTED_TOKEN>");
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, "")}`);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new WaApiError(
        `Network error calling the WhatsApp Cloud API: ${this.redact(detail)}`,
        0,
        undefined,
        undefined,
        undefined,
        true,
      );
    }

    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    if (!response.ok) throw this.toError(response, json);
    return json as T;
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  delete<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("DELETE", path, undefined, params);
  }

  private toError(response: Response, json: unknown): WaApiError {
    const err: WaErrorBody =
      json && typeof json === "object" && "error" in json
        ? ((json as { error: WaErrorBody }).error ?? {})
        : {};

    const code = err.code;
    const subcode = err.error_subcode;
    const rawMessage = err.error_user_msg || err.message || response.statusText;

    let hint = "";
    let retryable = response.status >= 500;

    if (code === 190 || response.status === 401) {
      hint = " The WABA access token is invalid or expired. Reconnect the WhatsApp number.";
    } else if (code === 100 && subcode === 131047) {
      hint =
        " Outside the 24-hour customer-service window — only approved templates can be sent to this recipient.";
    } else if (code === 131026) {
      hint = " Message undeliverable (recipient unreachable or not on WhatsApp).";
    } else if (code === 131048 || code === 131056) {
      hint = " Spam or pair rate limit hit for this number — back off before retrying.";
      retryable = true;
    } else if (code === 130429 || code === 80007) {
      hint = " Throughput limit exceeded for this phone number.";
      retryable = true;
    } else if (code === 133010) {
      hint = " This phone number is not registered with WhatsApp Cloud API.";
    } else if (code === 132000 || code === 132001 || code === 132005) {
      hint = " Template error — check that the template is approved and variables match its shape.";
    }

    return new WaApiError(
      this.redact(
        `WhatsApp API error ${response.status}${code !== undefined ? ` (code ${code}${subcode ? `/${subcode}` : ""})` : ""}: ${rawMessage}.${hint}${err.fbtrace_id ? ` [fbtrace_id: ${err.fbtrace_id}]` : ""}`,
      ),
      response.status,
      code,
      subcode,
      err.fbtrace_id,
      retryable,
    );
  }
}
