import { z } from "zod";
import { CONTENT_LOCALES } from "@/lib/i18n/locales";

const requiredText = z.string().min(1);

const LegalSectionSchema = z.object({
  title: requiredText,
  body: requiredText,
});

export const TranslationSchema = z.object({
  en: requiredText,
  "zh-TW": requiredText,
  "zh-CN": requiredText,
  ko: requiredText,
  th: requiredText,
  fr: requiredText,
  de: requiredText,
  es: requiredText,
});

export const ChoiceSetSchema = z.tuple([
  requiredText,
  requiredText,
  requiredText,
]);

export const ChoicesByLangSchema = z.object({
  en: ChoiceSetSchema,
  "zh-TW": ChoiceSetSchema,
  "zh-CN": ChoiceSetSchema,
  ko: ChoiceSetSchema,
  th: ChoiceSetSchema,
  fr: ChoiceSetSchema,
  de: ChoiceSetSchema,
  es: ChoiceSetSchema,
});

export const PhraseContentSchema = z.object({
  romaji: requiredText,
  japanese: requiredText,
  audio_url: requiredText,
  translations: TranslationSchema,
  choices_by_lang: ChoicesByLangSchema,
  correct_choice_index: z.number().int().min(0).max(2),
});

export const PhraseRecordSchema = PhraseContentSchema.extend({
  id: z.string().uuid(),
  pack_id: z.string().min(1),
});

export const PublicPhraseRecordSchema = PhraseRecordSchema.omit({
  correct_choice_index: true,
});

export const AppMessagesSchema = z.object({
  Metadata: z.object({
    title: requiredText,
    description: requiredText,
  }),
  HomePage: z.object({
    title: requiredText,
    tagline: requiredText,
    sessionHint: requiredText,
    cta: requiredText,
    contact: requiredText,
    travelCta: requiredText,
    buyTravel: requiredText,
    playOwned: requiredText,
  }),
  Auth: z.object({
    guest: requiredText,
    saveProgress: requiredText,
    continueGoogle: requiredText,
    continueEmail: requiredText,
    emailPlaceholder: requiredText,
    sendLink: requiredText,
    signOut: requiredText,
    emailSent: requiredText,
    collisionTitle: requiredText,
    collisionBody: requiredText,
    useExisting: requiredText,
    stayGuest: requiredText,
    genericError: requiredText,
    linked: requiredText,
    checkoutGuard: requiredText,
    checkoutRedirecting: requiredText,
    checkoutError: requiredText,
    alreadyPurchased: requiredText,
    checkoutConfirmTitle: requiredText,
    checkoutConfirmBody: requiredText,
    checkoutConfirmContinue: requiredText,
    checkoutConfirmCancel: requiredText,
  }),
  Quiz: z.object({
    loading: requiredText,
    question: requiredText,
    playAudio: requiredText,
    correct: requiredText,
    incorrect: requiredText,
    next: requiredText,
    complete: requiredText,
    home: requiredText,
    paidLocked: requiredText,
    paidLockedHint: requiredText,
    startError: requiredText,
    gradeError: requiredText,
    heartsEmpty: requiredText,
    invalidChoice: requiredText,
    reloadQuiz: requiredText,
    notConfigured: requiredText,
    audioFallback: requiredText,
  }),
  Hearts: z.object({
    label: requiredText,
    nextIn: requiredText,
    full: requiredText,
  }),
  Success: z.object({
    title: requiredText,
    body: requiredText,
    cta: requiredText,
    accountCta: requiredText,
    confirming: requiredText,
    timeout: requiredText,
    retry: requiredText,
    contact: requiredText,
  }),
  Account: z.object({
    title: requiredText,
    subtitle: requiredText,
    empty: requiredText,
    purchasedAt: requiredText,
    manageBilling: requiredText,
    signInRequired: requiredText,
    noCustomer: requiredText,
    error: requiredText,
    openPack: requiredText,
  }),
  Legal: z.object({
    termsNav: requiredText,
    privacyNav: requiredText,
    tokushoNav: requiredText,
    accountNav: requiredText,
    updated: requiredText,
    terms: z.object({
      title: requiredText,
      intro: requiredText,
      apply: LegalSectionSchema,
      registration: LegalSectionSchema,
      fees: LegalSectionSchema,
      prohibited: LegalSectionSchema,
      interruption: LegalSectionSchema,
      copyright: LegalSectionSchema,
      disclaimer: LegalSectionSchema,
      changes: LegalSectionSchema,
      governing: LegalSectionSchema,
      contact: LegalSectionSchema,
    }),
    privacy: z.object({
      title: requiredText,
      intro: requiredText,
      collect: LegalSectionSchema,
      purpose: LegalSectionSchema,
      sharing: LegalSectionSchema,
      processors: LegalSectionSchema,
      retention: LegalSectionSchema,
      deletion: LegalSectionSchema,
      children: LegalSectionSchema,
      changes: LegalSectionSchema,
      contact: LegalSectionSchema,
    }),
    tokusho: z.object({
      title: requiredText,
      intro: requiredText,
      disclosureTitle: requiredText,
      disclosureBody: requiredText,
      labelSeller: requiredText,
      valueSeller: requiredText,
      labelOperator: requiredText,
      valueOperator: requiredText,
      labelAddress: requiredText,
      valueAddress: requiredText,
      labelPhone: requiredText,
      valuePhone: requiredText,
      labelEmail: requiredText,
      valueEmail: requiredText,
      labelServiceName: requiredText,
      valueServiceName: requiredText,
      labelServiceUrl: requiredText,
      valueServiceUrl: requiredText,
      labelPrice: requiredText,
      valuePrice: requiredText,
      labelExtraFees: requiredText,
      valueExtraFees: requiredText,
      labelPaymentMethod: requiredText,
      valuePaymentMethod: requiredText,
      labelPaymentTiming: requiredText,
      valuePaymentTiming: requiredText,
      labelDelivery: requiredText,
      valueDelivery: requiredText,
      labelCancel: requiredText,
      valueCancel: requiredText,
      labelRefund: requiredText,
      valueRefund: requiredText,
      labelEnvironment: requiredText,
      valueEnvironment: requiredText,
    }),
  }),
});

export type TranslationDictionary = z.infer<typeof TranslationSchema>;
export type ChoicesByLang = z.infer<typeof ChoicesByLangSchema>;
export type PhraseContent = z.infer<typeof PhraseContentSchema>;
export type PhraseRecord = z.infer<typeof PhraseRecordSchema>;
export type PublicPhraseRecord = z.infer<typeof PublicPhraseRecordSchema>;
export type AppMessages = z.infer<typeof AppMessagesSchema>;

export function assertSupportedLocales(
  dictionary: Record<string, unknown>,
): asserts dictionary is TranslationDictionary {
  const missing = CONTENT_LOCALES.filter((locale) => !(locale in dictionary));
  if (missing.length > 0) {
    throw new Error(`Missing locale keys: ${missing.join(", ")}`);
  }
  TranslationSchema.parse(dictionary);
}
