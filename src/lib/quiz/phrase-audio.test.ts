import { describe, expect, it, vi } from "vitest";
import {
  classifyPlaybackError,
  fallbackToneSequence,
  isPlayableAudioUrl,
  nextPhrasePlaybackAction,
  playFallbackTones,
  playPhraseAudio,
} from "@/lib/quiz/phrase-audio";

describe("isPlayableAudioUrl", () => {
  it("rejects empty, whitespace, and placeholder URLs", () => {
    expect(isPlayableAudioUrl("")).toBe(false);
    expect(isPlayableAudioUrl("   ")).toBe(false);
    expect(isPlayableAudioUrl("#")).toBe(false);
    expect(isPlayableAudioUrl("about:blank")).toBe(false);
  });

  it("accepts relative and absolute audio paths", () => {
    expect(isPlayableAudioUrl("/audio/arigatou.mp3")).toBe(true);
    expect(isPlayableAudioUrl("https://cdn.example.com/hai.mp3")).toBe(true);
  });
});

describe("classifyPlaybackError", () => {
  it("treats autoplay policy failures as blocked", () => {
    const error = new Error("play() failed because the user didn't interact");
    error.name = "NotAllowedError";
    expect(classifyPlaybackError(error)).toBe("blocked");
  });

  it("treats missing files and decode errors as missing", () => {
    const error = new Error("media_error");
    error.name = "MediaError";
    expect(classifyPlaybackError(error)).toBe("missing");
    expect(classifyPlaybackError(new Error("404"))).toBe("missing");
  });
});

describe("nextPhrasePlaybackAction", () => {
  it("uses Web Audio fallback when no file is configured", () => {
    expect(nextPhrasePlaybackAction({ url: "" })).toBe("play-fallback");
  });

  it("tries the file first when a URL is present", () => {
    expect(nextPhrasePlaybackAction({ url: "/audio/hai.mp3" })).toBe("play-file");
  });

  it("falls back after a missing-file failure", () => {
    expect(
      nextPhrasePlaybackAction({
        url: "/audio/missing.mp3",
        lastResult: "missing",
      }),
    ).toBe("play-fallback");
  });

  it("waits for a user gesture when autoplay is blocked", () => {
    expect(
      nextPhrasePlaybackAction({
        url: "/audio/hai.mp3",
        lastResult: "blocked",
      }),
    ).toBe("await-gesture");
  });
});

describe("playPhraseAudio", () => {
  it("plays the file when it loads", async () => {
    const tryFile = vi.fn().mockResolvedValue(undefined);
    const tryFallback = vi.fn();
    await expect(
      playPhraseAudio({
        url: "/audio/hai.mp3",
        text: "はい",
        tryFile,
        tryFallback,
      }),
    ).resolves.toBe("file");
    expect(tryFile).toHaveBeenCalledWith("/audio/hai.mp3");
    expect(tryFallback).not.toHaveBeenCalled();
  });

  it("uses Web Audio fallback when the file is missing", async () => {
    const missing = Object.assign(new Error("media_error"), { name: "MediaError" });
    const tryFile = vi.fn().mockRejectedValue(missing);
    const tryFallback = vi.fn().mockResolvedValue(undefined);
    await expect(
      playPhraseAudio({
        url: "/audio/missing.mp3",
        text: "ありがとう",
        tryFile,
        tryFallback,
      }),
    ).resolves.toBe("fallback");
    expect(tryFallback).toHaveBeenCalledWith("ありがとう");
  });

  it("skips the missing file and uses fallback immediately when URL is empty", async () => {
    const tryFile = vi.fn();
    const tryFallback = vi.fn().mockResolvedValue(undefined);
    await expect(
      playPhraseAudio({
        url: "",
        text: "すみません",
        tryFile,
        tryFallback,
      }),
    ).resolves.toBe("fallback");
    expect(tryFile).not.toHaveBeenCalled();
  });

  it("reports blocked autoplay so the UI can show a large play button", async () => {
    const blocked = Object.assign(new Error("NotAllowedError"), {
      name: "NotAllowedError",
    });
    const tryFile = vi.fn().mockRejectedValue(blocked);
    const tryFallback = vi.fn();
    await expect(
      playPhraseAudio({
        url: "/audio/hai.mp3",
        text: "はい",
        tryFile,
        tryFallback,
      }),
    ).resolves.toBe("blocked");
    expect(tryFallback).not.toHaveBeenCalled();
  });
});

describe("fallbackToneSequence", () => {
  it("maps phrase text to a non-empty pentatonic sequence", () => {
    const tones = fallbackToneSequence("ありがとう");
    expect(tones.length).toBeGreaterThan(0);
    expect(tones.every((hz) => hz > 100 && hz < 2000)).toBe(true);
  });

  it("still produces tones when the phrase text is empty", () => {
    expect(fallbackToneSequence("")).toEqual([392, 494, 587]);
  });
});

describe("playFallbackTones", () => {
  it("schedules an oscillator per mora on the Web Audio graph", async () => {
    const connect = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    const setValueAtTime = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const context = {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({
        type: "sine" as OscillatorType,
        frequency: { value: 0 },
        connect,
        start,
        stop,
      }),
      createGain: () => ({
        gain: { setValueAtTime, exponentialRampToValueAtTime },
        connect,
      }),
    };

    await playFallbackTones([440, 392], context);
    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenCalled();
  });
});
