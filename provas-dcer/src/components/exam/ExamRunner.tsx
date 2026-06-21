"use client";

import { useEffect, useRef, useState } from "react";
import { submitAttemptAction } from "@/app/actions/student";
import { getCategoryLabel } from "@/lib/categories";
import { formatDuration } from "@/lib/text";

type Question = {
  id: string;
  position: number;
  statement: string;
  points: number;
  options: {
    id: string;
    label: string;
    text: string;
  }[];
};

type ExamRunnerProps = {
  attemptId: string;
  studentName: string;
  churchName: string;
  category: string;
  applicationTitle: string;
  examTitle: string;
  expiresAt: string;
  questions: Question[];
};

export function ExamRunner({
  attemptId,
  studentName,
  churchName,
  category,
  applicationTitle,
  examTitle,
  expiresAt,
  questions,
}: ExamRunnerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextRemaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);

      if (nextRemaining <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        formRef.current?.requestSubmit();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return (
    <form
      ref={formRef}
      action={submitAttemptAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="space-y-4"
    >
      <input type="hidden" name="attemptId" value={attemptId} />

      <header className="sticky top-0 z-10 rounded-lg border border-[#d8def0] bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#000060]">{applicationTitle}</p>
            <h1 className="text-2xl font-semibold">{examTitle}</h1>
            <p className="mt-1 text-xs text-[#5d6480]">
              {studentName} - {churchName} - {getCategoryLabel(category)}
            </p>
          </div>
          <div className="rounded-md bg-[#000060] px-4 py-3 text-center text-white">
            <p className="text-xs uppercase tracking-[0.16em] text-[#fff200]">Tempo restante</p>
            <p className="font-mono text-3xl font-semibold">{formatDuration(remainingSeconds)}</p>
          </div>
        </div>
      </header>

      {questions.map((question) => (
        <section key={question.id} className="rounded-lg border border-[#d8def0] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {question.position}. {question.statement}
            </h2>
            <span className="shrink-0 rounded-full bg-[#effaf2] px-2 py-1 text-xs font-semibold text-[#1f623e]">
              {question.points} pt
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            {question.options.map((option) => (
              <label
                key={option.id}
                className="flex items-start gap-3 rounded-md border border-[#d8def0] p-3 transition has-[:checked]:border-[#000060] has-[:checked]:bg-[#effaf2]"
              >
                <input
                  type="radio"
                  name={`option_${question.id}`}
                  value={option.id}
                  className="mt-1 h-5 w-5 accent-[#000060]"
                />
                <span>
                  <span className="font-semibold">{option.label}) </span>
                  {option.text}
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="rounded-lg border border-[#d8def0] bg-white p-4 shadow-sm">
        <button className="w-full rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044]">
          Enviar prova
        </button>
        <p className="mt-2 text-center text-xs text-[#5d6480]">
          Ao enviar, a prova sera registrada para correcao. O resultado nao sera exibido nesta tela.
        </p>
      </div>
    </form>
  );
}
