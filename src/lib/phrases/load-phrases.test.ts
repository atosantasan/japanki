import { describe, expect, it, vi } from "vitest";
import { loadPhrasesForRequest } from "@/lib/phrases/load-phrases";

const validPhrase = {
  id: "11111111-1111-4111-8111-111111111111",
  pack_id: "survival",
  romaji: "arigatou",
  japanese: "ありがとう",
  audio_url: "/audio/arigatou.mp3",
  translations: {
    en: "Thank you",
    "zh-TW": "謝謝",
    "zh-CN": "谢谢",
    ko: "감사합니다",
    th: "ขอบคุณ",
    fr: "Merci",
    de: "Danke",
    es: "Gracias",
  },
  choices_by_lang: {
    en: ["Thank you", "Sorry", "Hello"],
    "zh-TW": ["謝謝", "對不起", "你好"],
    "zh-CN": ["谢谢", "对不起", "你好"],
    ko: ["감사합니다", "미안합니다", "안녕하세요"],
    th: ["ขอบคุณ", "ขอโทษ", "สวัสดี"],
    fr: ["Merci", "Désolé", "Bonjour"],
    de: ["Danke", "Entschuldigung", "Hallo"],
    es: ["Gracias", "Lo siento", "Hola"],
  },
  correct_choice_index: 0,
};

describe("loadPhrasesForRequest", () => {
  it("returns 401 when getUser finds no session", async () => {
    const result = await loadPhrasesForRequest("survival", {
      getUser: vi.fn().mockResolvedValue(null),
      getPack: vi.fn(),
      hasPurchase: vi.fn(),
      getPhrases: vi.fn(),
    });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "Not authenticated" });
  });

  it("checks user_purchases for paid packs before returning phrases", async () => {
    const hasPurchase = vi.fn().mockResolvedValue(false);
    const getPhrases = vi.fn();

    const result = await loadPhrasesForRequest("travel", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      getPack: vi.fn().mockResolvedValue({ id: "travel", is_free: false, is_active: true }),
      hasPurchase,
      getPhrases,
    });

    expect(hasPurchase).toHaveBeenCalledWith("user-1", "travel");
    expect(getPhrases).not.toHaveBeenCalled();
    expect(result.status).toBe(403);
  });

  it("returns validated phrases for an authenticated free-pack user", async () => {
    const result = await loadPhrasesForRequest("survival", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      getPack: vi.fn().mockResolvedValue({ id: "survival", is_free: true, is_active: true }),
      hasPurchase: vi.fn(),
      getPhrases: vi.fn().mockResolvedValue([validPhrase]),
    });

    expect(result.status).toBe(200);
    if (result.status !== 200) {
      throw new Error("expected phrases payload");
    }
    const [phrase] = result.body.phrases;
    expect(phrase).toMatchObject({
      id: validPhrase.id,
      pack_id: validPhrase.pack_id,
      romaji: validPhrase.romaji,
      japanese: validPhrase.japanese,
      audio_url: validPhrase.audio_url,
      translations: validPhrase.translations,
      choices_by_lang: validPhrase.choices_by_lang,
    });
    expect(phrase).not.toHaveProperty("correct_choice_index");
  });

  it("omits correct_choice_index from the public phrase payload", async () => {
    const result = await loadPhrasesForRequest("survival", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      getPack: vi.fn().mockResolvedValue({ id: "survival", is_free: true, is_active: true }),
      hasPurchase: vi.fn(),
      getPhrases: vi.fn().mockResolvedValue([validPhrase]),
    });

    expect(result.status).toBe(200);
    if (result.status !== 200) {
      throw new Error("expected phrases payload");
    }
    expect(result.body.phrases).toHaveLength(1);
    expect(result.body.phrases[0]).not.toHaveProperty("correct_choice_index");
    expect(JSON.stringify(result.body)).not.toContain("correct_choice_index");
  });

  it("returns 404 when a free pack is inactive", async () => {
    const hasPurchase = vi.fn();
    const getPhrases = vi.fn();

    const result = await loadPhrasesForRequest("survival", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      getPack: vi.fn().mockResolvedValue({
        id: "survival",
        is_free: true,
        is_active: false,
      }),
      hasPurchase,
      getPhrases,
    });

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: "Content pack not found" });
    expect(hasPurchase).not.toHaveBeenCalled();
    expect(getPhrases).not.toHaveBeenCalled();
  });

  it("returns phrases for a purchased paid pack that is temporarily inactive", async () => {
    const getPhrases = vi.fn().mockResolvedValue([{
      ...validPhrase,
      pack_id: "travel",
    }]);

    const result = await loadPhrasesForRequest("travel", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      getPack: vi.fn().mockResolvedValue({
        id: "travel",
        is_free: false,
        is_active: false,
      }),
      hasPurchase: vi.fn().mockResolvedValue(true),
      getPhrases,
    });

    expect(result.status).toBe(200);
    expect(getPhrases).toHaveBeenCalledWith("travel");
  });

  it("returns 404 for an inactive paid pack when the user has not purchased it", async () => {
    const getPhrases = vi.fn();

    const result = await loadPhrasesForRequest("travel", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      getPack: vi.fn().mockResolvedValue({
        id: "travel",
        is_free: false,
        is_active: false,
      }),
      hasPurchase: vi.fn().mockResolvedValue(false),
      getPhrases,
    });

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: "Content pack not found" });
    expect(getPhrases).not.toHaveBeenCalled();
  });
});
