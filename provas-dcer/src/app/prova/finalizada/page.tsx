import Link from "next/link";

type FinishedPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

const messages: Record<string, string> = {
  enviada: "Sua prova foi enviada com sucesso.",
  "ja-enviada": "Esta prova ja foi enviada anteriormente.",
  expirada: "O tempo desta prova foi encerrado.",
};

export default async function FinishedPage({ searchParams }: FinishedPageProps) {
  const params = searchParams ? await searchParams : {};
  const message = messages[params.status || ""] || "Registro finalizado.";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg rounded-lg bg-white p-6 text-center shadow-sm ring-1 ring-[#d8def0]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#000060]">Prova finalizada</p>
        <h1 className="mt-3 text-3xl font-semibold">{message}</h1>
        <p className="mt-3 text-sm leading-6 text-[#5d6480]">
          Obrigado. O resultado nao e exibido para o aluno ao final da prova; a equipe responsavel fara a conferencia.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md bg-[#000060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000044]"
        >
          Voltar ao inicio
        </Link>
      </section>
    </main>
  );
}
