"use client";

import { useEffect } from "react";

export function WarmQuizApis() {
  useEffect(() => {
    void fetch("/api/quiz/start", { method: "GET", cache: "no-store" });
    void fetch("/api/quiz/submit-answer", { method: "GET", cache: "no-store" });
  }, []);

  return null;
}
