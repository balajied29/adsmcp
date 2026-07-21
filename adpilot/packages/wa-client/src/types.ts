export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED";

export interface WaTemplate {
  id: string; // Meta template id
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: unknown[]; // Meta's component tree (header/body/footer/buttons)
}

export interface WaPhoneNumber {
  id: string; // phone_number_id
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating?: string; // GREEN | YELLOW | RED
}

export interface SendTemplateParams {
  to: string; // E.164, no leading +
  templateName: string;
  languageCode: string;
  /** Positional {{1}}, {{2}}, ... body variables. */
  bodyParams?: string[];
}

export interface SendResult {
  wamid: string;
}

export interface EmbeddedSignupExchange {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string; // long-lived business-integration system-user token
}
