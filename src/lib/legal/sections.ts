export const LEGAL_TERMS_SECTIONS = [
  "apply",
  "registration",
  "fees",
  "prohibited",
  "interruption",
  "copyright",
  "disclaimer",
  "changes",
  "governing",
  "contact",
] as const;

export const LEGAL_PRIVACY_SECTIONS = [
  "collect",
  "purpose",
  "sharing",
  "processors",
  "retention",
  "deletion",
  "children",
  "changes",
  "contact",
] as const;

export const TOKUSHO_FIELDS = [
  "seller",
  "operator",
  "address",
  "phone",
  "email",
  "serviceName",
  "serviceUrl",
  "price",
  "extraFees",
  "paymentMethod",
  "paymentTiming",
  "delivery",
  "cancel",
  "refund",
  "environment",
] as const;

export type LegalTermsSection = (typeof LEGAL_TERMS_SECTIONS)[number];
export type LegalPrivacySection = (typeof LEGAL_PRIVACY_SECTIONS)[number];
export type TokushoField = (typeof TOKUSHO_FIELDS)[number];
