"use client";

import { type FormEvent, useState } from "react";
import { startAttemptAction } from "@/app/actions/student";

type ApplicationOption = {
  id: string;
  title: string;
  examTitle: string;
  durationMinutes: number;
  alreadyStarted: boolean;
};

type StudentLookup = {
  student: {
    registrationNumber: string;
    name: string;
    category: string;
    categoryLabel: string;
    churchName: string;
    embassyName: string | null;
    registrationIssuedAt: string | null;
    registrationExpiresAt: string | null;
    birthDate: string | null;
    embassyAdmissionDate: string | null;
  };
  applications: ApplicationOption[];
};

export function StudentEntry() {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [lookup, setLookup] = useState<StudentLookup | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedApplicationId = lookup?.applications.some((item) => item.id === applicationId)
    ? applicationId
    : "";
  const application = lookup?.applications.find((item) => item.id === selectedApplicationId);
  const canStart = Boolean(lookup && selectedApplicationId);

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanRegistrationNumber = registrationNumber.trim();

    if (cleanRegistrationNumber.length < 3) {
      setLookup(null);
      setApplicationId("");
      setLookupError("Informe o numero da carteirinha.");
      return;
    }

    setIsLoading(true);
    setLookupError("");
    setLookup(null);
    setApplicationId("");

    try {
      const response = await fetch("/prova/aluno", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrationNumber: cleanRegistrationNumber,
        }),
      });
      const data = (await response.json()) as StudentLookup | { message?: string };

      if (!response.ok) {
        setLookupError("message" in data && data.message ? data.message : "Nao foi possivel localizar a carteirinha.");
        return;
      }

      const nextLookup = data as StudentLookup;
      setLookup(nextLookup);
      setApplicationId(nextLookup.applications.length === 1 ? nextLookup.applications[0].id : "");
    } catch {
      setLookupError("Nao foi possivel consultar a carteirinha agora.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetLookup(nextRegistrationNumber: string) {
    setRegistrationNumber(nextRegistrationNumber);
    setLookup(null);
    setApplicationId("");
    setLookupError("");
  }

  return (
    <div className="rounded-lg border border-[#d8def0] bg-white p-4 shadow-sm sm:p-6">
      <form onSubmit={handleLookup} className="grid gap-4">
        <label className="block">
          <span className="text-sm font-medium">Numero da carteirinha</span>
          <input
            name="registrationNumberLookup"
            value={registrationNumber}
            onChange={(event) => resetLookup(event.target.value)}
            className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 font-mono outline-none focus:ring-2 focus:ring-[#000060]"
            placeholder="Ex.: 210300100049"
            autoComplete="off"
            inputMode="numeric"
          />
        </label>

        <button
          disabled={isLoading}
          className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:bg-[#888fa8]"
        >
          {isLoading ? "Consultando..." : "Buscar meus dados"}
        </button>
      </form>

      {lookupError ? (
        <div className="mt-4 rounded-md border border-[#f2b8bf] bg-[#fff4f2] px-4 py-3 text-sm text-[#b00018]">
          {lookupError}
        </div>
      ) : null}

      {lookup ? (
        <div className="mt-4 grid gap-4">
          <section className="rounded-md border border-[#d8def0] bg-[#f8faff] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[#5d6480]">Embaixador</p>
                <h2 className="mt-1 text-xl font-semibold text-[#111827]">{lookup.student.name}</h2>
              </div>
              <span className="w-fit rounded-full bg-[#effaf2] px-3 py-1 text-xs font-semibold text-[#1f623e]">
                {lookup.student.categoryLabel}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <StudentData label="Carteirinha" value={lookup.student.registrationNumber} mono />
              <StudentData label="Igreja" value={lookup.student.churchName} />
              <StudentData label="Embaixada" value={lookup.student.embassyName || "-"} />
              <StudentData label="Emissao" value={formatDate(lookup.student.registrationIssuedAt)} />
              <StudentData label="Validade" value={formatDate(lookup.student.registrationExpiresAt)} />
              <StudentData label="Nascimento" value={formatDate(lookup.student.birthDate)} />
              <StudentData label="Admissao na embaixada" value={formatDate(lookup.student.embassyAdmissionDate)} />
            </dl>
          </section>

          <form action={startAttemptAction} className="grid gap-4">
            <input type="hidden" name="registrationNumber" value={lookup.student.registrationNumber} />

            <label className="block">
              <span className="text-sm font-medium">Prova disponivel</span>
              <select
                name="applicationId"
                value={selectedApplicationId}
                onChange={(event) => setApplicationId(event.target.value)}
                disabled={!lookup.applications.length}
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f2f4fb] disabled:text-[#888fa8]"
              >
                {!lookup.applications.length ? (
                  <option value="">Nenhuma prova disponivel para este embaixador</option>
                ) : (
                  <option value="">Selecione a prova</option>
                )}
                {lookup.applications.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} - {item.examTitle}
                    {item.alreadyStarted ? " (continuar)" : ""}
                  </option>
                ))}
              </select>
            </label>

            {application ? (
              <div className="rounded-md bg-[#effaf2] px-3 py-2 text-sm text-[#1f623e]">
                Tempo total: <strong>{application.durationMinutes} minutos</strong>.
                {application.alreadyStarted ? " Esta prova ja foi iniciada e sera retomada." : ""}
              </div>
            ) : null}

            <button
              disabled={!canStart}
              className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:bg-[#888fa8]"
            >
              Iniciar prova
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#5d6480]">
          Digite o numero da carteirinha para o sistema localizar seu cadastro, igreja, embaixada e provas liberadas.
        </p>
      )}
    </div>
  );
}

function StudentData({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-[#5d6480]">{label}</dt>
      <dd className={`mt-1 font-semibold text-[#111827] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}
