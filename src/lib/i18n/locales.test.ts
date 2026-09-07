import { describe, expect, it } from "vitest";
import {
  CONTENT_LOCALES,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  toContentLocale,
} from "@/lib/i18n/locales";

describe("locales", () => {
  it("includes ja in SUPPORTED_LOCALES", () => {
    expect(SUPPORTED_LOCALES).toContain("ja");
  });

  it("does not include ja in CONTENT_LOCALES", () => {
    expect(CONTENT_LOCALES).not.toContain("ja");
  });

  it("labels ja as 日本語 (ja)", () => {
    expect(LOCALE_LABELS.ja).toBe("日本語 (ja)");
  });

  it("maps ja UI locale to English content locale", () => {
    expect(toContentLocale("ja")).toBe("en");
  });

  it("keeps content locales unchanged", () => {
    expect(toContentLocale("ko")).toBe("ko");
  });
});
