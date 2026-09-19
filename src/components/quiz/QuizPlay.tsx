"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { requestStartQuiz } from "@/lib/quiz/start-quiz-client";
import { requestSubmitAnswer } from "@/lib/quiz/submit-answer-client";
import {
  playHtmlAudio,
  playPhraseAudio,
  playWebAudioFallback,
} from "@/lib/quiz/phrase-audio";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { canPlayWithHearts } from "@/lib/hearts/recovery";
import type { SupportedLocale } from "@/lib/i18n/locales";
import type { PreparedQuestion } from "@/lib/quiz/prepare-question";

type QuizPlayProps = {
  packId: string;
};

type Feedback = "correct" | "incorrect" | null;

export function QuizPlay({ packId }: QuizPlayProps) {
  const t = useTranslations("Quiz");
  const locale = useLocale() as SupportedLocale;
  const { configured, profile, loading: authLoading, updateHearts } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<
    "notConfigured" | "paidLocked" | "startError" | null
  >(configured ? null : "notConfigured");
  const [hearts, setHearts] = useState(profile?.hearts ?? 5);
  const [queue, setQueue] = useState<PreparedQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [submitError, setSubmitError] = useState(false);
  const [revealedCorrectText, setRevealedCorrectText] = useState<string | null>(
    null,
  );
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [trackedAudioId, setTrackedAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const submittingRef = useRef(false);

  const current = queue[index];
  const complete = !loading && !errorKey && queue.length === 5 && index >= 5;

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setErrorKey("notConfigured");
          setLoading(false);
        }
        return;
      }

      try {
        const started = await requestStartQuiz({ packId, locale });
        if (cancelled) {
          return;
        }
        setHearts(started.remainingHearts);
        updateHearts(started.remainingHearts, started.updatedAt);
        setSessionId(started.sessionId);
        setQueue(started.questions);
        setIndex(0);
        setFeedback(null);
        setErrorKey(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!cancelled) {
          setErrorKey(
            message.includes("Purchased pack permission required")
              ? "paidLocked"
              : "startError",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, locale, packId, updateHearts]);

  const currentId = current?.phrase.id ?? null;
  if (currentId !== trackedAudioId) {
    setTrackedAudioId(currentId);
    setNeedsManualPlay(false);
    setUsedFallback(false);
  }

  const playCurrent = useCallback(async () => {
    if (!current) {
      return;
    }
    audioRef.current?.pause();
    const result = await playPhraseAudio({
      url: current.phrase.audio_url,
      text: current.phrase.japanese || current.phrase.romaji,
      tryFile: async (url) => {
        const audio = await playHtmlAudio(url);
        audioRef.current = audio;
      },
      tryFallback: playWebAudioFallback,
    });
    if (result === "blocked") {
      setNeedsManualPlay(true);
      return;
    }
    setNeedsManualPlay(false);
    setUsedFallback(result === "fallback");
  }, [current]);

  useEffect(() => {
    audioRef.current?.pause();
    if (!current) {
      return;
    }
    void playCurrent();
    return () => {
      audioRef.current?.pause();
    };
  }, [current, playCurrent]);

  const playManually = useCallback(() => {
    void playCurrent();
  }, [playCurrent]);

  const onChoose = useCallback(
    (selectedIndex: number) => {
      if (
        !current ||
        !sessionId ||
        feedback ||
        submittingRef.current ||
        !canPlayWithHearts(hearts)
      ) {
        return;
      }
      const selectedText = current.choices[selectedIndex];
      if (!selectedText) {
        return;
      }
      submittingRef.current = true;
      const isCorrect = selectedText === current.correctChoiceText;
      setSubmitError(false);
      setFeedback(isCorrect ? "correct" : "incorrect");
      setRevealedCorrectText(current.correctChoiceText);
      void requestSubmitAnswer({
        sessionId,
        phraseId: current.phrase.id,
        selectedChoiceText: selectedText,
        locale,
      })
        .then((result) => {
          setHearts(result.remainingHearts);
          updateHearts(result.remainingHearts, result.updatedAt);
        })
        .catch(() => {
          setSubmitError(true);
        });
    },
    [current, feedback, hearts, locale, sessionId, updateHearts],
  );

  const goNext = useCallback(() => {
    submittingRef.current = false;
    setFeedback(null);
    setRevealedCorrectText(null);
    setIndex((value) => value + 1);
  }, []);

  const status = useMemo(() => {
    if (errorKey) {
      return t(errorKey);
    }
    if (loading) {
      return t("loading");
    }
    return null;
  }, [errorKey, loading, t]);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-16 pt-4 md:px-10">
      {status ? (
        <div className="mt-16 max-w-lg text-xl leading-relaxed text-cream/80">
          {status}
          <div className="mt-8">
            <Link className="text-sm underline decoration-cream/30" href="/">
              {t("home")}
            </Link>
          </div>
        </div>
      ) : complete ? (
        <div className="mt-16">
          <h1 className="text-5xl font-semibold tracking-tight text-cream">
            {t("complete")}
          </h1>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink"
          >
            {t("home")}
          </Link>
        </div>
      ) : current ? (
        <section className="mt-10">
          <p className="text-sm uppercase tracking-[0.28em] text-sun">
            {t("question", { current: index + 1 })}
          </p>
          <p className="mt-6 font-[family-name:var(--font-noto-sans-jp)] text-5xl text-cream">
            {current.phrase.japanese}
          </p>
          <p className="mt-3 text-lg tracking-wide text-cream/70">
            {current.phrase.romaji}
          </p>
          {needsManualPlay ? (
            <button
              type="button"
              onClick={playManually}
              className="mt-8 flex h-24 w-24 items-center justify-center rounded-full bg-sun text-sm font-semibold text-cream"
            >
              {t("playAudio")}
            </button>
          ) : null}
          {usedFallback && !needsManualPlay ? (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <p className="max-w-md text-sm text-cream/65">{t("audioFallback")}</p>
              <button
                type="button"
                onClick={playManually}
                className="rounded-full border border-cream/25 px-4 py-2 text-sm font-semibold text-cream"
              >
                {t("playAudio")}
              </button>
            </div>
          ) : null}
          {!canPlayWithHearts(hearts) && feedback !== "incorrect" ? (
            <p className="mt-6 text-sm text-sun">{t("heartsEmpty")}</p>
          ) : null}
          {submitError ? (
            <p className="mt-6 text-sm text-sun">{t("gradeError")}</p>
          ) : null}
          <div className="mt-8 grid gap-3">
            {current.choices.map((choice, choiceIndex) => {
              const selected =
                Boolean(feedback) && choice === revealedCorrectText;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={Boolean(feedback) || !canPlayWithHearts(hearts)}
                  onClick={() => void onChoose(choiceIndex)}
                  className={`rounded-2xl border px-5 py-4 text-left text-lg transition ${
                    selected
                      ? "border-sun bg-sun/20 text-cream"
                      : "border-cream/15 bg-cream/5 text-cream hover:border-cream/40"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          {feedback ? (
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-lg text-cream">
                {feedback === "correct" ? t("correct") : t("incorrect")}
              </p>
              <button
                type="button"
                onClick={goNext}
                className="rounded-full bg-cream px-5 py-2 text-sm font-semibold text-ink"
              >
                {index === 4 ? t("complete") : t("next")}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
