"use client";

import { useMemo, useState } from "react";
import { createExamAction, updateExamAction } from "@/app/actions/admin";
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

export type ExamBuilderInitialData = {
  applicationId?: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingPercent: number;
  applicationTitle: string;
  accessCode: string;
  churchIds: string[];
  categories: CategoryCode[];
  questions: QuestionDraft[];
};

type ExamBuilderProps = {
  churches: ChurchOption[];
  initialData?: ExamBuilderInitialData;
  locked?: boolean;
  mode?: "create" | "edit";
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

function getInitialQuestions(initialData?: ExamBuilderInitialData) {
  return initialData?.questions.length ? initialData.questions : [newQuestion()];
}

export function ExamBuilder({ churches, initialData, locked = false, mode = "create" }: ExamBuilderProps) {
  const isEditing = mode === "edit";
  const [title, setTitle] = useState(initialData?.title || "Nova prova");
  const [description, setDescription] = useState(initialData?.description || "");
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes || 60);
  const [passingPercent, setPassingPercent] = useState(initialData?.passingPercent ?? 70);
  const [applicationTitle, setApplicationTitle] = useState(initialData?.applicationTitle || "Aplicacao principal");
  const [accessCode, setAccessCode] = useState(initialData?.accessCode || "");
  const [selectedChurchIds, setSelectedChurchIds] = useState(() =>
    initialData?.churchIds.length ? initialData.churchIds : churches.map((church) => church.id),
  );
  const [selectedCategories, setSelectedCategories] = useState<CategoryCode[]>(() =>
    initialData?.categories.length ? initialData.categories : CATEGORIES.map((category) => category.value),
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => getInitialQuestions(initialData));

  const totalPoints = questions.reduce((sum, question) => sum + Number(question.points || 0), 0);
  const minimumPoints = (totalPoints * Number(passingPercent || 0)) / 100;

  const payload = useMemo(
    () =>
      JSON.stringify({
        title,
        description,
        durationMinutes,
        passingPercent,
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
    [
      accessCode,
      applicationTitle,
      description,
      durationMinutes,
      passingPercent,
      questions,
      selectedCategories,
      selectedChurchIds,
      title,
    ],
  );

  function toggleChurch(churchId: string) {
    if (locked) return;

    setSelectedChurchIds((current) =>
      current.includes(churchId) ? current.filter((id) => id !== churchId) : [...current, churchId],
    );
  }

  function toggleCategory(category: CategoryCode) {
    if (locked) return;

    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  }

  function updateQuestion(id: string, update: Partial<QuestionDraft>) {
    if (locked) return;

    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...update } : question)),
    );
  }

  function updateOption(questionId: string, optionIndex: number, text: string) {
    if (locked) return;

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
    <form action={isEditing ? updateExamAction : createExamAction} className="space-y-5">
      <input type="hidden" name="payload" value={payload} />
      {initialData?.applicationId ? (
        <input type="hidden" name="applicationId" value={initialData.applicationId} />
      ) : null}

      {locked ? (
        <div className="rounded-lg border border-[#f2b8bf] bg-[#fff4f2] p-4 text-sm text-[#b00018]">
          Esta prova ja foi iniciada por alunos. Para preservar respostas e gabaritos, crie uma nova aplicacao se
          precisar mudar perguntas, alternativas ou participantes.
        </div>
      ) : null}

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <h2 className="text-lg font-semibold">Dados da prova</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium">Titulo da prova</span>
            <input
              value={title}
              disabled={locked}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f8faff]"
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium">Descricao opcional</span>
            <textarea
              value={description}
              disabled={locked}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f8faff]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Tempo total da prova (minutos)</span>
            <input
              type="number"
              min={1}
              max={300}
              value={durationMinutes}
              disabled={locked}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f8faff]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Percentual minimo para aprovacao</span>
            <div className="mt-1 flex rounded-md border border-[#c5cce4] bg-white focus-within:ring-2 focus-within:ring-[#000060]">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={passingPercent}
                disabled={locked}
                onChange={(event) => setPassingPercent(Number(event.target.value))}
                className="w-full rounded-l-md px-3 py-3 outline-none disabled:bg-[#f8faff]"
              />
              <span className="flex items-center rounded-r-md bg-[#f8faff] px-3 text-sm font-semibold text-[#5d6480]">
                %
              </span>
            </div>
            <span className="mt-1 block text-xs text-[#5d6480]">
              Com {totalPoints || 0} ponto(s), o minimo sera {minimumPoints.toFixed(1)} ponto(s).
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Titulo da aplicacao</span>
            <input
              value={applicationTitle}
              disabled={locked}
              onChange={(event) => setApplicationTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f8faff]"
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium">Codigo opcional da aplicacao</span>
            <input
              value={accessCode}
              disabled={locked}
              onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 font-mono uppercase outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f8faff]"
              placeholder="Ex.: PROVA2026"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <h2 className="text-lg font-semibold">Igrejas participantes</h2>
          <div className="mt-3 space-y-2">
            {churches.map((church) => (
              <label
                key={church.id}
                className="flex items-center justify-between gap-3 rounded-md border border-[#e8ecf8] px-3 py-2"
              >
                <span>
                  <span className="block text-sm font-medium">{church.name}</span>
                  <span className="text-xs text-[#5d6480]">{church.students} aluno(s)</span>
                </span>
                <input
                  type="checkbox"
                  checked={selectedChurchIds.includes(church.id)}
                  disabled={locked}
                  onChange={() => toggleChurch(church.id)}
                  className="h-5 w-5 accent-[#000060]"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#d8def0] bg-white p-4">
          <h2 className="text-lg font-semibold">Categorias participantes</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {CATEGORIES.map((category) => (
              <label
                key={category.value}
                className="flex items-center justify-between gap-3 rounded-md border border-[#e8ecf8] px-3 py-3"
              >
                <span className="text-sm font-medium">{category.label}</span>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.value)}
                  disabled={locked}
                  onChange={() => toggleCategory(category.value)}
                  className="h-5 w-5 accent-[#000060]"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#d8def0] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Questoes</h2>
            <p className="text-sm text-[#5d6480]">
              Todas as questoes sao de multipla escolha. Marque uma alternativa correta em cada questao.
            </p>
          </div>
          <button
            type="button"
            disabled={locked}
            onClick={() => setQuestions((current) => [...current, newQuestion()])}
            className="rounded-md border border-[#000060] px-4 py-2 text-sm font-semibold text-[#000060] hover:bg-[#effaf2] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Adicionar questao
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {questions.map((question, questionIndex) => (
            <div key={question.id} className="rounded-lg border border-[#e8ecf8] bg-[#fbfcff] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <label className="block flex-1">
                  <span className="text-sm font-medium">Pergunta {questionIndex + 1}</span>
                  <textarea
                    value={question.statement}
                    disabled={locked}
                    onChange={(event) => updateQuestion(question.id, { statement: event.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f8faff]"
                    placeholder="Digite o enunciado"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
                  <div className="rounded-md border border-[#d8def0] bg-white px-3 py-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#000060]">
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
                      disabled={locked}
                      onChange={(event) => updateQuestion(question.id, { points: Number(event.target.value) })}
                      className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f8faff]"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-2 lg:grid-cols-2">
                {question.options.map((option, optionIndex) => {
                  const isCorrect = question.correctOptionIndex === optionIndex;

                  return (
                    <label
                      key={option.label}
                      className={`flex gap-3 rounded-md border p-3 ${
                        isCorrect ? "border-[#000060] bg-[#effaf2]" : "border-[#d8def0] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={isCorrect}
                        disabled={locked}
                        onChange={() => updateQuestion(question.id, { correctOptionIndex: optionIndex })}
                        className="mt-1 h-5 w-5 accent-[#000060]"
                        aria-label={`Marcar alternativa ${option.label} como correta`}
                      />
                      <span className="flex-1">
                        <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-xs font-semibold text-[#000060]">
                            Alternativa {option.label}
                          </span>
                          <span
                            className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${
                              isCorrect ? "bg-[#000060] text-white" : "bg-[#f8faff] text-[#5d6480]"
                            }`}
                          >
                            {isCorrect ? "Resposta correta" : "Marcar correta"}
                          </span>
                        </span>
                        <input
                          value={option.text}
                          disabled={locked}
                          onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                          className="mt-2 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f8faff]"
                          placeholder={`Texto da alternativa ${option.label}`}
                        />
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={locked || questions.length === 1}
                  onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}
                  className="rounded-md border border-[#efb6bf] px-3 py-2 text-sm font-medium text-[#b00018] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remover questao
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 rounded-lg border border-[#d8def0] bg-white/95 p-4 shadow-lg backdrop-blur">
        <button
          disabled={locked}
          className="w-full rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isEditing ? "Salvar alteracoes da prova" : "Criar prova e liberar aplicacao"}
        </button>
      </div>
    </form>
  );
}
