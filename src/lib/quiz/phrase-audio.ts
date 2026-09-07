export function isPlayableAudioUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  return lower !== "#" && lower !== "about:blank";
}

export function classifyPlaybackError(error: unknown): "blocked" | "missing" {
  if (!error) {
    return "missing";
  }
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  const message = error instanceof Error ? error.message : String(error);
  if (
    name === "NotAllowedError" ||
    /not allowed|user didn't interact|user did not interact/i.test(message)
  ) {
    return "blocked";
  }
  return "missing";
}

export type PhrasePlaybackAction =
  | "play-file"
  | "play-fallback"
  | "await-gesture";

export function nextPhrasePlaybackAction(input: {
  url: string | null | undefined;
  lastResult?: "ok" | "blocked" | "missing";
}): PhrasePlaybackAction {
  if (input.lastResult === "blocked") {
    return "await-gesture";
  }
  if (input.lastResult === "missing" || !isPlayableAudioUrl(input.url)) {
    return "play-fallback";
  }
  return "play-file";
}

export async function playPhraseAudio(input: {
  url: string;
  text: string;
  tryFile: (url: string) => Promise<void>;
  tryFallback: (text: string) => Promise<void>;
}): Promise<"file" | "fallback" | "blocked"> {
  const action = nextPhrasePlaybackAction({ url: input.url });
  if (action === "play-fallback") {
    try {
      await input.tryFallback(input.text);
      return "fallback";
    } catch (error) {
      if (classifyPlaybackError(error) === "blocked") {
        return "blocked";
      }
      throw error;
    }
  }

  try {
    await input.tryFile(input.url);
    return "file";
  } catch (error) {
    if (classifyPlaybackError(error) === "blocked") {
      return "blocked";
    }
    try {
      await input.tryFallback(input.text);
      return "fallback";
    } catch (fallbackError) {
      if (classifyPlaybackError(fallbackError) === "blocked") {
        return "blocked";
      }
      throw fallbackError;
    }
  }
}

const PENTATONIC_HZ = [261.63, 293.66, 329.63, 392.0, 440.0];

export function fallbackToneSequence(text: string): number[] {
  const source = [...text.replace(/\s+/g, "")];
  if (source.length === 0) {
    return [392, 494, 587];
  }
  return source.slice(0, 8).map((character, index) => {
    const code = character.codePointAt(0) ?? 0;
    return PENTATONIC_HZ[(code + index) % PENTATONIC_HZ.length];
  });
}

export type FallbackAudioContext = {
  currentTime: number;
  destination: object;
  createOscillator: () => {
    type: OscillatorType;
    frequency: { value: number };
    connect: (node: unknown) => void;
    start: (when?: number) => void;
    stop: (when?: number) => void;
  };
  createGain: () => {
    gain: {
      setValueAtTime: (value: number, time: number) => void;
      exponentialRampToValueAtTime: (value: number, time: number) => void;
    };
    connect: (node: unknown) => void;
  };
};

export async function playFallbackTones(
  frequencies: number[],
  context: FallbackAudioContext,
): Promise<void> {
  const step = 0.16;
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const start = context.currentTime + index * step;
    const end = start + 0.14;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end);
  });
}

export function playHtmlAudio(
  url: string,
  AudioCtor: typeof Audio = Audio,
): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const audio = new AudioCtor(url);
    const fail = () => {
      cleanup();
      reject(Object.assign(new Error("media_error"), { name: "MediaError" }));
    };
    const ready = () => {
      void audio
        .play()
        .then(() => {
          cleanup();
          resolve(audio);
        })
        .catch((error: unknown) => {
          cleanup();
          reject(error);
        });
    };
    const cleanup = () => {
      audio.removeEventListener("error", fail);
      audio.removeEventListener("canplaythrough", ready);
    };
    audio.addEventListener("error", fail);
    audio.addEventListener("canplaythrough", ready);
    audio.load();
  });
}

let sharedAudioContext: AudioContext | null = null;

export async function playWebAudioFallback(text: string): Promise<void> {
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    throw Object.assign(new Error("media_error"), { name: "MediaError" });
  }
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextCtor();
  }
  if (sharedAudioContext.state === "suspended") {
    await sharedAudioContext.resume();
  }
  await playFallbackTones(
    fallbackToneSequence(text),
    sharedAudioContext as unknown as FallbackAudioContext,
  );
}
