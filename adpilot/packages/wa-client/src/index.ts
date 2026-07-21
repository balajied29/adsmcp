/**
 * Typed high-level WhatsApp Cloud API client, shared by the web app and the
 * worker. One instance per connected WABA phone number.
 */
import { WaClient, WaApiError } from "./graph.js";
import type {
  EmbeddedSignupExchange,
  SendResult,
  SendTemplateParams,
  TemplateCategory,
  WaPhoneNumber,
  WaTemplate,
} from "./types.js";

export { WaClient, WaApiError } from "./graph.js";
export * from "./types.js";

export const DEFAULT_API_VERSION = "v25.0";

export class WaAdsClient {
  readonly graph: WaClient;

  constructor(
    accessToken: string,
    private readonly phoneNumberId: string,
    apiVersion: string = DEFAULT_API_VERSION,
  ) {
    this.graph = new WaClient(accessToken, apiVersion);
  }

  // ---------- Messaging ----------

  async sendTemplateMessage(params: SendTemplateParams): Promise<SendResult> {
    const res = await this.graph.post<{ messages: { id: string }[] }>(
      `${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: params.to,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.languageCode },
          ...(params.bodyParams?.length && {
            components: [
              {
                type: "body",
                parameters: params.bodyParams.map((text) => ({ type: "text", text })),
              },
            ],
          }),
        },
      },
    );
    const wamid = res.messages?.[0]?.id;
    if (!wamid) throw new Error("WhatsApp did not return a message id");
    return { wamid };
  }

  async sendTextMessage(to: string, body: string): Promise<SendResult> {
    const res = await this.graph.post<{ messages: { id: string }[] }>(
      `${this.phoneNumberId}/messages`,
      { messaging_product: "whatsapp", to, type: "text", text: { body } },
    );
    const wamid = res.messages?.[0]?.id;
    if (!wamid) throw new Error("WhatsApp did not return a message id");
    return { wamid };
  }

  // ---------- Templates ----------

  async listTemplates(wabaId: string): Promise<WaTemplate[]> {
    const res = await this.graph.get<{ data: any[] }>(`${wabaId}/message_templates`, {
      limit: "200",
    });
    return (res.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      components: t.components ?? [],
    }));
  }

  async createTemplate(
    wabaId: string,
    params: {
      name: string;
      language: string;
      category: TemplateCategory;
      bodyText: string;
      headerText?: string;
      footerText?: string;
    },
  ): Promise<{ id: string; status: string }> {
    const components: unknown[] = [{ type: "BODY", text: params.bodyText }];
    if (params.headerText) components.push({ type: "HEADER", format: "TEXT", text: params.headerText });
    if (params.footerText) components.push({ type: "FOOTER", text: params.footerText });

    const res = await this.graph.post<{ id: string; status: string }>(
      `${wabaId}/message_templates`,
      {
        name: params.name,
        language: params.language,
        category: params.category,
        components,
      },
    );
    return res;
  }

  // ---------- Phone numbers / WABA ----------

  async getPhoneNumber(): Promise<WaPhoneNumber> {
    const res = await this.graph.get<any>(this.phoneNumberId, {
      fields: "display_phone_number,verified_name,quality_rating",
    });
    return {
      id: this.phoneNumberId,
      displayPhoneNumber: res.display_phone_number,
      verifiedName: res.verified_name,
      qualityRating: res.quality_rating,
    };
  }

  // Media (image/document header templates) is out of scope for this pass —
  // v1 broadcasts are text-variable templates only. Cloud API media upload
  // is a multipart POST to `{phoneNumberId}/media`; add here when header
  // media templates are needed.
}

// ---------- Embedded Signup token exchange ----------

/** Exchange the Embedded Signup code for a long-lived WABA system-user token. */
export async function exchangeEmbeddedSignupCode(
  appId: string,
  appSecret: string,
  code: string,
  apiVersion: string = DEFAULT_API_VERSION,
): Promise<EmbeddedSignupExchange> {
  const url = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);
  const res = await fetch(url);
  const json: any = await res.json();
  if (!res.ok || !json.access_token) {
    throw new WaApiError(
      `Embedded Signup code exchange failed: ${json?.error?.message ?? res.statusText}`,
      res.status,
      json?.error?.code,
      undefined,
      undefined,
      false,
    );
  }
  // The WABA id and phone number id arrive via the JS SDK's session-info
  // event during signup, not this exchange — the caller supplies them.
  return { wabaId: "", phoneNumberId: "", accessToken: json.access_token };
}
