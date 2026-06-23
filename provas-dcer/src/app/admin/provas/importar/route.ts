import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdminContext } from "@/lib/auth";
import type { CategoryCode } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportQuestion = {
  id: string;
  statement: string;
  points: number;
  category?: CategoryCode;
  theme: string;
  difficulty: string;
  bibleReference: string;
  explanation: string;
  sourceStatus: string;
  active: boolean;
  options: { label: string; text: string }[];
  correctOptionIndex: number;
};

type ImportResult = {
  title: string;
  durationMinutes: number;
  passingPercent: number;
  categories: CategoryCode[];
  questions: ImportQuestion[];
  warnings: string[];
};

const fieldAliases = new Map<string, keyof ImportColumns>([
  ["id", "id"],
  ["categoria", "category"],
  ["tema", "theme"],
  ["nivel", "difficulty"],
  ["pergunta", "statement"],
  ["alternativaa", "optionA"],
  ["alternativab", "optionB"],
  ["alternativac", "optionC"],
  ["alternativad", "optionD"],
  ["respostacerta", "correctAnswer"],
  ["referenciabiblica", "bibleReference"],
  ["descricao", "explanation"],
  ["tempodaprovaemminutos", "durationMinutes"],
  ["percentualdeaprovacao", "passingPercent"],
  ["status", "sourceStatus"],
]);

type ImportColumns = {
  id: string;
  category: string;
  theme: string;
  difficulty: string;
  statement: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  bibleReference: string;
  explanation: string;
  durationMinutes: string;
  passingPercent: string;
  sourceStatus: string;
};

export async function POST(request: Request) {
  await requireAdminContext();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return importError("Envie um arquivo .xlsx ou .csv.");
    }

    const result = await parseImportFile(file);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Exam import failed", error);
    return importError(error instanceof Error ? error.message : "Nao foi possivel importar a prova.");
  }
}

async function parseImportFile(file: File): Promise<ImportResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
  const workbook = XLSX.read(isCsv ? buffer.toString("utf8") : buffer, {
    type: isCsv ? "string" : "buffer",
    cellDates: false,
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("O arquivo nao possui nenhuma aba para importar.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    blankrows: false,
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error("A primeira aba esta vazia.");
  }

  const questions: ImportQuestion[] = [];
  const warnings: string[] = [];
  const rowDurations: number[] = [];
  const rowPassingPercents: number[] = [];

  rows.forEach((rawRow, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const row = normalizeRow(rawRow);

    if (isBlankRow(row)) return;

    const statement = requiredCell(row.statement, rowNumber, "Pergunta");
    const options = [
      { label: "A", text: requiredCell(row.optionA, rowNumber, "Alternativa A") },
      { label: "B", text: requiredCell(row.optionB, rowNumber, "Alternativa B") },
      { label: "C", text: requiredCell(row.optionC, rowNumber, "Alternativa C") },
      { label: "D", text: requiredCell(row.optionD, rowNumber, "Alternativa D") },
    ];
    const correctOptionIndex = resolveCorrectOption(row.correctAnswer, options, rowNumber);
    const category = parseCategory(row.category);

    if (row.category && !category) {
      warnings.push(`Linha ${rowNumber}: categoria "${row.category}" nao foi reconhecida.`);
    }

    const duration = parseNumber(row.durationMinutes);
    const passingPercent = parseNumber(row.passingPercent);

    if (duration !== null) rowDurations.push(Math.round(duration));
    if (passingPercent !== null) rowPassingPercents.push(normalizePercent(passingPercent));

    questions.push({
      id: crypto.randomUUID(),
      statement,
      points: 1,
      category,
      theme: row.theme,
      difficulty: row.difficulty,
      bibleReference: row.bibleReference,
      explanation: row.explanation,
      sourceStatus: row.sourceStatus,
      active: parseActiveStatus(row.sourceStatus),
      options,
      correctOptionIndex,
    });
  });

  if (questions.length === 0) {
    throw new Error("Nenhuma questao valida foi encontrada no arquivo.");
  }

  const themes = uniqueNonEmpty(questions.map((question) => question.theme));
  const categories = uniqueCategories(questions);
  const title = themes.length === 1 ? `Prova - ${themes[0]}` : titleFromFileName(file.name);

  return {
    title,
    durationMinutes: clamp(firstValue(rowDurations, 60), 1, 300),
    passingPercent: clamp(firstValue(rowPassingPercents, 70), 0, 100),
    categories,
    questions,
    warnings,
  };
}

function normalizeRow(rawRow: Record<string, unknown>): ImportColumns {
  const result: ImportColumns = {
    id: "",
    category: "",
    theme: "",
    difficulty: "",
    statement: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "",
    bibleReference: "",
    explanation: "",
    durationMinutes: "",
    passingPercent: "",
    sourceStatus: "",
  };

  Object.entries(rawRow).forEach(([header, value]) => {
    const field = fieldAliases.get(normalizeKey(header));
    if (!field) return;

    result[field] = String(value ?? "").trim();
  });

  return result;
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function isBlankRow(row: ImportColumns) {
  return !row.statement && !row.optionA && !row.optionB && !row.optionC && !row.optionD;
}

function requiredCell(value: string, rowNumber: number, label: string) {
  const text = value.trim();

  if (!text) {
    throw new Error(`Linha ${rowNumber}: preencha a coluna "${label}".`);
  }

  return text;
}

function resolveCorrectOption(
  rawAnswer: string,
  options: { label: string; text: string }[],
  rowNumber: number,
) {
  const answer = rawAnswer.trim();

  if (!answer) {
    throw new Error(`Linha ${rowNumber}: preencha a coluna "Resposta Certa".`);
  }

  const normalizedAnswer = normalizeKey(answer.replace(/^alternativa/i, ""));
  const labelIndex = options.findIndex((option) => normalizeKey(option.label) === normalizedAnswer);

  if (labelIndex >= 0) return labelIndex;

  const textIndex = options.findIndex((option) => normalizeKey(option.text) === normalizeKey(answer));

  if (textIndex >= 0) return textIndex;

  throw new Error(`Linha ${rowNumber}: a resposta certa deve ser A, B, C ou D.`);
}

function parseCategory(value: string): CategoryCode | undefined {
  const category = normalizeKey(value);

  if (!category) return undefined;
  if (category.includes("adolesc")) return "ADOLESCENTES";
  if (category.includes("juvenil")) return "JUVENIL";
  if (category.includes("junior")) return "JUNIOR";
  return undefined;
}

function parseActiveStatus(value: string) {
  const status = normalizeKey(value);

  if (!status) return true;

  return !["inativa", "inativo", "arquivada", "arquivado", "cancelada", "cancelado", "false", "0", "nao"].includes(
    status,
  );
}

function parseNumber(value: string) {
  const cleanValue = value.replace("%", "").replace(",", ".").trim();
  if (!cleanValue) return null;

  const number = Number(cleanValue);
  return Number.isFinite(number) ? number : null;
}

function normalizePercent(value: number) {
  if (value > 0 && value <= 1) return value * 100;
  return value;
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueCategories(questions: ImportQuestion[]) {
  return Array.from(
    new Set(questions.map((question) => question.category).filter((category): category is CategoryCode => Boolean(category))),
  );
}

function firstValue(values: number[], fallback: number) {
  return values.find((value) => Number.isFinite(value)) ?? fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function titleFromFileName(fileName: string) {
  const title = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title || "Prova importada";
}

function importError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
