"use client";

import { type FormEvent, useEffect, useState } from "react";
import { startAttemptAction } from "@/app/actions/student";

type ApplicationOption = {
  id: string;
  title: string;
  examTitle: string;
  eventTypeLabel: string;
  durationMinutes: number;
  baseDurationMinutes: number;
  endsAt: string | null;
  alreadyStarted: boolean;
};

type EventLookup = {
  registration: {
    registrationCode: string;
    name: string;
    category: string;
    categoryLabel: string;
    churchName: string;
    eventTitle: string;
  };
  applications: ApplicationOption[];
};

export function EventEntry({ initialRegistrationCode = "" }: { initialRegistrationCode?: string }) {
  const [registrationCode, setRegistrationCode] = useState(initialRegistrationCode);
  const [applicationId, setApplicationId] = useState("");
  const [lookup, setLookup] = useState<EventLookup | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedApplicationId = lookup?.applications.some((item) => item.id === applicationId)
    ? applicationId
    : "";
  const application = lookup?.applications.find((item) => item.id === selectedApplicationId);
  const canStart = Boolean(lookup && selectedApplicationId);

  async function lookupRegistration(nextRegistrationCode: string) {
    const cleanRegistrationCode = nextRegistrationCode.trim();

    if (cleanRegistrationCode.length !== 6) {
      setLookup(null);
      setApplicationId("");
      setLookupError("Informe o numero de inscricao do evento com 6 caracteres.");
      return;
    }

    setIsLoading(true);
    setLookupError("");
    setLookup(null);
    setApplicationId("");

    try {
      const response = await fetch("/prova/evento/aluno", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrationCode: cleanRegistrationCode,
        }),
      });
      const data = (await response.json()) as EventLookup | { message?: string };

      if (!response.ok) {
        setLookupError("message" in data && data.message ? data.message : "Nao foi possivel localizar a inscricao.");
        return;
      }

      const nextLookup = data as EventLookup;
      setLookup(nextLookup);
      setRegistrationCode(nextLookup.registration.registrationCode);
      setApplicationId(nextLookup.applications.length === 1 ? nextLookup.applications[0].id : "");
    } catch {
      setLookupError("Nao foi possivel consultar a inscricao agora.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await lookupRegistration(registrationCode);
  }

  useEffect(() => {
    if (initialRegistrationCode.trim().length === 6) {
      const timer = window.setTimeout(() => {
        void lookupRegistration(initialRegistrationCode);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [initialRegistrationCode]);

  return (
    <div className="rounded-lg border border-[#d8def0] bg-white p-4 shadow-sm sm:p-6">
      <form onSubmit={handleLookup} className="grid gap-4">
        <label className="block">
          <span className="text-sm font-medium">Numero de inscricao do evento</span>
          <input
            name="eventRegistrationLookup"
            value={registrationCode}
            onChange={(event) => {
              setRegistrationCode(event.target.value.toUpperCase());
              setLookup(null);
              setApplicationId("");
              setLookupError("");
            }}
            className="mt-1 w-full rounded-md border border-[#c5cce4] px-3 py-3 font-mono uppercase outline-none focus:ring-2 focus:ring-[#000060]"
            placeholder="Ex.: A7K2P9"
            autoComplete="off"
            maxLength={6}
          />
        </label>

        <button
          disabled={isLoading}
          className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:bg-[#888fa8]"
        >
          {isLoading ? "Consultando..." : "Buscar provas do evento"}
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
            <p className="text-xs uppercase tracking-[0.14em] text-[#5d6480]">Evento</p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">{lookup.registration.eventTitle}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <EventData label="Inscrito" value={lookup.registration.name} />
              <EventData label="Inscricao" value={lookup.registration.registrationCode} mono />
              <EventData label="Igreja" value={lookup.registration.churchName} />
              <EventData label="Categoria" value={lookup.registration.categoryLabel} />
            </dl>
          </section>

          <form action={startAttemptAction} className="grid gap-4">
            <input type="hidden" name="eventRegistrationCode" value={lookup.registration.registrationCode} />

            <label className="block">
              <span className="text-sm font-medium">Prova do evento</span>
              <select
                name="applicationId"
                value={selectedApplicationId}
                onChange={(event) => setApplicationId(event.target.value)}
                disabled={!lookup.applications.length}
                className="mt-1 w-full rounded-md border border-[#c5cce4] bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-[#000060] disabled:bg-[#f2f4fb] disabled:text-[#888fa8]"
              >
                {!lookup.applications.length ? (
                  <option value="">Nenhuma prova liberada para esta inscricao</option>
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
                Tipo: <strong>{application.eventTypeLabel}</strong>. Tempo total:{" "}
                <strong>{application.durationMinutes} minutos</strong>.{" "}
                {application.endsAt ? (
                  <>
                    Disponivel ate <strong>{formatApplicationDate(application.endsAt)}</strong>.
                  </>
                ) : (
                  <strong>Expiracao ilimitada.</strong>
                )}
                {application.alreadyStarted ? " Esta prova ja foi iniciada e sera retomada." : ""}
              </div>
            ) : null}

            <button
              disabled={!canStart}
              className="rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044] disabled:cursor-not-allowed disabled:bg-[#888fa8]"
            >
              Iniciar prova do evento
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function EventData({
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

function formatApplicationDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
