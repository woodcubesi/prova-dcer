"use client";

import { useMemo, useState } from "react";
import { createExamAction } from "@/app/actions/admin";
import { CATEGORIES, type CategoryCode } from "@/lib/categories";

type ChurchOption = {
  id: string;
  name: string;
  students: number;
};

type QuestionDraft = {
  id: string;
  statement: string;
  points: number;
  options: { label: string; text: string }[];
  correctOptionIndex: number;
};

function newQuestion(): QuestionDraft {
  return {
    id: crypto.randomUUID(),
    statement: "",
    points: 1,
    correctOptionIndex: 0,
    options: [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
    ],
  };
}

export function ExamBuilder({ churches }: { churches: ChurchOption[] }) {
  const [title, setTitle] = useState("Nova prova");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [applicationTitle, setApplicationTitle] = useState("Aplicacao principal");
  const [accessCode, setAccessCode] = useState("");
  const [selectedChurchIds, setSelectedChurchIds] = useState(() => churches.map((church) => church.id));
  const [selectedCategories, setSelectedCategories] = useState(() => CATEGORIES.map((category) => category.value));
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => [newQuestion()]);

  const payload = useMemo(
    () =>
      JSON.stringify({
        title,
        description,
        durationMinutes,
        applicationTitle,
        accessCode,
        churchIds: selectedChurchIds,
        categories: selectedCategories,
        questions: questions.map((question) => ({
          type: "MULTIPLE_CHOICE",
          statement: question.statement,
          points: question.points,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
        })),
      }),
    [accessCode, applicationTitle, description, durationMinutes, questions, selectedCategories, selectedChurchIds, title],
  );

  function toggleChurch(churchId: string) {
    setSelectedChurchIds((current) =>
      current.includes(churchId) ? current.filter((id) => id !== churchId) : [...current, churchId],
    );
  }

  function toggleCategory(category: CategoryCode) {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  }

  function updateQuestion(id: string, update: Partial<QuestionDraft>) {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...update } : question)),
    );
  }

  function updateOption(questionId: string, optionIndex: number, text: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((option, index) =>
                index === optionIndex ? { ...option, text } : option,
              ),
            }
          : question,
      ),
    );
  }

  return (
    <form action={createExamAction} className="space-y-5">
      <input type="hidden" name="payload" value={payload} />

      <section className="rounded-lg border border-[#dfe6dd] bg-white p-4">
        <h2 className="text-lg font-semibold">Dados da prova</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium">Titulo da prova</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium">Descricao opcional</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Tempo total da prova (minutos)</span>
            <input
              type="number"
              min={1}
              max={300}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Titulo da aplicacao</span>
            <input
              value={applicationTitle}
              onChange={(event) => setApplicationTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium">Codigo opcional da aplicacao</span>
            <input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-3 font-mono uppercase outline-none focus:ring-2 focus:ring-[#2c6d49]"
              placeholder="Ex.: PROVA2026"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Igrejas participantes</h2>
          <div className="mt-3 space-y-2">
            {churches.map((church) => (
              <label key={church.id} className="flex items-center justify-between gap-3 rounded-md border border-[#edf1eb] px-3 py-2">
                <span>
                  <span className="block text-sm font-medium">{church.name}</span>
                  <span className="text-xs text-[#66736a]">{church.students} aluno(s)</span>
                </span>
                <input
                  type="checkbox"
                  checked={selectedChurchIds.includes(church.id)}
                  onChange={() => toggleChurch(church.id)}
                  className="h-5 w-5 accent-[#2c6d49]"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#dfe6dd] bg-white p-4">
          <h2 className="text-lg font-semibold">Categorias participantes</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {CATEGORIES.map((category) => (
              <label key={category.value} className="flex items-center justify-between gap-3 rounded-md border border-[#edf1eb] px-3 py-3">
                <span className="text-sm font-medium">{category.label}</span>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.value)}
                  onChange={() => toggleCategory(category.value)}
                  className="h-5 w-5 accent-[#2c6d49]"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#dfe6dd] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Questoes</h2>
            <p className="text-sm text-[#66736a]">Todas as questoes sao de multipla escolha e corrigidas automaticamente.</p>
          </div>
          <button
            type="button"
            onClick={() => setQuestions((current) => [...current, newQuestion()])}
            className="rounded-md border border-[#2c6d49] px-4 py-2 text-sm font-semibold text-[#2c6d49] hover:bg-[#effaf2]"
          >
            Adicionar questao
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {questions.map((question, questionIndex) => (
            <div key={question.id} className="rounded-lg border border-[#edf1eb] bg-[#fbfcfa] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <label className="block flex-1">
                  <span className="text-sm font-medium">Pergunta {questionIndex + 1}</span>
                  <textarea
                    value={question.statement}
                    onChange={(event) => updateQuestion(question.id, { statement: event.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
                    placeholder="Digite o enunciado"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
                  <div className="rounded-md border border-[#dfe6dd] bg-white px-3 py-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2c6d49]">
                      Tipo
                    </span>
                    <p className="mt-1 text-sm font-medium">Multipla escolha</p>
                  </div>
                  <label className="block">
                    <span className="text-sm font-medium">Pontos</span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={question.points}
                      onChange={(event) => updateQuestion(question.id, { points: Number(event.target.value) })}
                      className="mt-1 w-full rounded-md border border-[#cdd8cf] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#2c6d49]"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-2 lg:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <label key={option.label} className="flex gap-3 rounded-md border border-[#dfe6dd] bg-white p-3">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={question.correctOptionIndex === optionIndex}
                      onChange={() => updateQuestion(question.id, { correctOptionIndex: optionIndex })}
                      className="mt-3 h-5 w-5 accent-[#2c6d49]"
                    />
                    <span className="flex-1">
                      <span className="text-xs font-semibold text-[#2c6d49]">Alternativa {option.label}</span>
                      <input
                        value={option.text}
                        onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                        className="mt-1 w-full rounded-md border border-[#cdd8cf] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2c6d49]"
                        placeholder={`Texto da alternativa ${option.label}`}
                      />
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={questions.length === 1}
                  onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}
                  className="rounded-md border border-[#d7b6ad] px-3 py-2 text-sm font-medium text-[#8d3b2d] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remover questao
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 rounded-lg border border-[#dfe6dd] bg-white/95 p-4 shadow-lg backdrop-blur">
        <button className="w-full rounded-md bg-[#12382a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c513d] sm:w-auto">
          Criar prova e liberar aplicacao
        </button>
      </div>
    </form>
  );
}
