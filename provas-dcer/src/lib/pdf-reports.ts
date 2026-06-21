import { existsSync } from "fs";
import { join } from "path";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import { getCategoryLabel } from "@/lib/categories";
import { formatPercent, formatScore, getApprovalResult } from "@/lib/report-metrics";
import { formatDuration } from "@/lib/text";

type PdfQuestion = {
  id: string;
  position: number;
  statement: string;
  points: number;
  options: Array<{
    id: string;
    label: string;
    text: string;
    isCorrect: boolean;
  }>;
};

type PdfAnswer = {
  questionId: string;
  selectedOption?: {
    label: string;
    text: string;
  } | null;
  pointsAwarded?: number | null;
  isCorrect?: boolean | null;
};

export type StudentCorrectionPdfData = {
  studentName: string;
  churchName: string;
  category: string;
  examTitle: string;
  applicationTitle: string;
  submittedAt?: Date | null;
  status: string;
  timeUsedSeconds?: number | null;
  score: number;
  totalPoints: number;
  passingPercent: number;
  questions: PdfQuestion[];
  answers: PdfAnswer[];
};

export type ApplicationSummaryPdfData = {
  examTitle: string;
  applicationTitle: string;
  accessCode: string;
  passingPercent: number;
  rows: Array<{
    studentName: string;
    churchName: string;
    category: string;
    status: string;
    score: number;
    totalPoints: number;
    timeUsedSeconds?: number | null;
  }>;
};

const pageMargin = 48;
const brandColor = "#000060";
const brandYellow = "#fff200";
const brandRed = "#e00010";
const mutedColor = "#5d6480";
const borderColor = "#d8def0";
const lightFill = "#f8faff";
const successColor = "#1f623e";
const dangerColor = "#b00018";
const dcerLogoPath = join(process.cwd(), "public", "brand", "dcer-paulista-logo.png");
const erInsigniaPath = join(process.cwd(), "public", "brand", "embaixadores-rei-insignia.png");

export async function createPdfBuffer(build: (doc: PDFKit.PDFDocument) => void) {
  const doc = new PDFDocument({
    size: "A4",
    margin: pageMargin,
    bufferPages: true,
    info: {
      Producer: "Provas DCER Paulista",
      Creator: "Provas DCER Paulista",
    },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  build(doc);
  addPageNumbers(doc);
  doc.end();

  return done;
}

export function makePdfFilename(value: string) {
  const cleanValue = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${cleanValue || "relatorio"}.pdf`;
}

export function buildStudentCorrectionPdf(data: StudentCorrectionPdfData) {
  return createPdfBuffer((doc) => {
    doc.info.Title = `Correcao - ${data.studentName}`;
    drawHeader(doc, "Correcao individual", data.examTitle);
    drawMetaGrid(doc, [
      ["Embaixador", data.studentName],
      ["Igreja", data.churchName],
      ["Categoria", getCategoryLabel(data.category)],
      ["Aplicacao", data.applicationTitle],
      ["Status", getStatusLabel(data.status)],
      ["Envio", data.submittedAt ? data.submittedAt.toLocaleString("pt-BR") : "-"],
    ]);

    const result = getApprovalResult(data.score, data.totalPoints, data.passingPercent);
    drawSummaryCards(doc, [
      ["Pontuacao", `${formatScore(data.score)} / ${formatScore(data.totalPoints)}`],
      ["Acertos", formatPercent(result.percent)],
      ["Erros", formatPercent(result.errorPercent)],
      ["Minimo", formatPercent(data.passingPercent)],
      ["Resultado", result.label],
      ["Tempo usado", data.timeUsedSeconds ? formatDuration(data.timeUsedSeconds) : "-"],
    ]);

    sectionTitle(doc, "Questoes e respostas");
    const answerByQuestion = new Map(data.answers.map((answer) => [answer.questionId, answer]));

    data.questions.forEach((question) => {
      const answer = answerByQuestion.get(question.id);
      const correctOption = question.options.find((option) => option.isCorrect);
      const studentAnswer = answer?.selectedOption
        ? `${answer.selectedOption.label}) ${answer.selectedOption.text}`
        : "Sem resposta";
      const correctAnswer = correctOption ? `${correctOption.label}) ${correctOption.text}` : "-";
      const isCorrect = Boolean(answer?.isCorrect);

      ensureSpace(doc, 136);
      const startY = doc.y;
      doc
        .roundedRect(pageMargin, startY, contentWidth(doc), 1, 1)
        .fill(isCorrect ? successColor : dangerColor);
      doc.y = startY + 10;
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(brandColor)
        .text(`Questao ${question.position} - ${formatScore(question.points)} ponto(s)`, pageMargin, doc.y);
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10).fillColor("#111827").text(question.statement, {
        width: contentWidth(doc),
      });
      doc.moveDown(0.45);
      doc.font("Helvetica-Bold").fillColor("#111827").text(`Resposta do embaixador: `, { continued: true });
      doc.font("Helvetica").text(studentAnswer);
      doc.font("Helvetica-Bold").text(`Gabarito: `, { continued: true });
      doc.font("Helvetica").text(correctAnswer);
      doc.font("Helvetica-Bold").text(`Resultado: `, { continued: true });
      doc
        .font("Helvetica")
        .fillColor(isCorrect ? successColor : dangerColor)
        .text(`${isCorrect ? "Correta" : "Errada"} - ${formatScore(answer?.pointsAwarded || 0)} ponto(s)`);
      doc.moveDown(1);
      doc.fillColor("#111827");
    });
  });
}

export function buildApplicationSummaryPdf(data: ApplicationSummaryPdfData) {
  return createPdfBuffer((doc) => {
    doc.info.Title = `Relatorio - ${data.examTitle}`;
    drawHeader(doc, "Relatorio da prova", data.examTitle);
    drawMetaGrid(doc, [
      ["Aplicacao", data.applicationTitle],
      ["Codigo", data.accessCode],
      ["Aprovacao minima", formatPercent(data.passingPercent)],
      ["Embaixadores que fizeram", String(data.rows.length)],
    ]);

    const rowResults = data.rows.map((row) => {
      const result = getApprovalResult(row.score, row.totalPoints, data.passingPercent);
      return { ...row, ...result };
    });
    const average = rowResults.length
      ? rowResults.reduce((sum, row) => sum + row.percent, 0) / rowResults.length
      : 0;
    const approved = rowResults.filter((row) => row.passed).length;
    const failed = rowResults.length - approved;

    drawSummaryCards(doc, [
      ["Media geral", formatPercent(average)],
      ["Aprovados", String(approved)],
      ["Reprovados", String(failed)],
      ["Total", String(rowResults.length)],
    ]);

    sectionTitle(doc, "Embaixadores");

    if (rowResults.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(mutedColor).text("Nenhum embaixador concluiu ou expirou esta prova.");
      return;
    }

    drawTableHeader(doc);
    rowResults.forEach((row) => {
      drawStudentRow(doc, row);
    });
  });
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  const headerY = pageMargin;
  const textX = pageMargin + 168;
  const textWidth = contentWidth(doc) - 225;

  drawImageIfExists(doc, dcerLogoPath, pageMargin, headerY, { width: 148 });
  drawImageIfExists(doc, erInsigniaPath, doc.page.width - pageMargin - 42, headerY + 4, { width: 42 });

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(brandColor)
    .text("Provas DCER Paulista", textX, headerY + 8, { width: textWidth });
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(title, textX, doc.y + 6, { width: textWidth });
  doc.font("Helvetica").fontSize(10).fillColor(mutedColor).text(subtitle, textX, doc.y + 4, { width: textWidth });

  const dividerY = headerY + 82;
  doc.rect(pageMargin, dividerY, contentWidth(doc), 3).fill(brandColor);
  doc.rect(pageMargin, dividerY + 5, contentWidth(doc) * 0.72, 2).fill(brandYellow);
  doc.rect(pageMargin + contentWidth(doc) * 0.72, dividerY + 5, contentWidth(doc) * 0.28, 2).fill(brandRed);
  doc.y = dividerY + 24;
}

function drawImageIfExists(
  doc: PDFKit.PDFDocument,
  imagePath: string,
  x: number,
  y: number,
  options: PDFKit.Mixins.ImageOption,
) {
  if (!existsSync(imagePath)) return;

  try {
    doc.image(imagePath, x, y, options);
  } catch {
    // PDF generation should continue even if an optional brand asset cannot be read.
  }
}

function drawMetaGrid(doc: PDFKit.PDFDocument, entries: Array<[string, string]>) {
  const gap = 10;
  const columns = 2;
  const cellWidth = (contentWidth(doc) - gap) / columns;
  const cellHeight = 42;
  const baseY = doc.y;

  entries.forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = pageMargin + column * (cellWidth + gap);
    const y = baseY + row * (cellHeight + 8);

    doc.roundedRect(x, y, cellWidth, cellHeight, 5).fillAndStroke(lightFill, borderColor);
    doc.font("Helvetica").fontSize(8).fillColor(mutedColor).text(label, x + 9, y + 8, {
      width: cellWidth - 18,
    });
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(value, x + 9, y + 21, {
      width: cellWidth - 18,
      ellipsis: true,
    });
  });

  doc.y = baseY + Math.ceil(entries.length / columns) * (cellHeight + 8) + 4;
}

function drawSummaryCards(doc: PDFKit.PDFDocument, entries: Array<[string, string]>) {
  ensureSpace(doc, 90);
  sectionTitle(doc, "Resumo");
  const gap = 8;
  const columns = 3;
  const cellWidth = (contentWidth(doc) - gap * (columns - 1)) / columns;
  const cellHeight = 46;
  const baseY = doc.y;

  entries.forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = pageMargin + column * (cellWidth + gap);
    const y = baseY + row * (cellHeight + 8);

    doc.roundedRect(x, y, cellWidth, cellHeight, 5).fillAndStroke("#ffffff", borderColor);
    doc.font("Helvetica").fontSize(8).fillColor(mutedColor).text(label, x + 8, y + 8, {
      width: cellWidth - 16,
    });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(brandColor).text(value, x + 8, y + 22, {
      width: cellWidth - 16,
      ellipsis: true,
    });
  });

  doc.y = baseY + Math.ceil(entries.length / columns) * (cellHeight + 8) + 8;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 32);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(brandColor).text(title);
  doc.moveDown(0.5);
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  ensureSpace(doc, 42);
  const y = doc.y;
  doc.roundedRect(pageMargin, y, contentWidth(doc), 24, 4).fill(brandColor);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  doc.text("Embaixador", pageMargin + 8, y + 8, { width: 142 });
  doc.text("Igreja", pageMargin + 154, y + 8, { width: 112 });
  doc.text("Categoria", pageMargin + 272, y + 8, { width: 70 });
  doc.text("Aproveit.", pageMargin + 348, y + 8, { width: 58 });
  doc.text("Resultado", pageMargin + 414, y + 8, { width: 72 });
  doc.y = y + 30;
}

function drawStudentRow(
  doc: PDFKit.PDFDocument,
  row: ApplicationSummaryPdfData["rows"][number] & {
    percent: number;
    passed: boolean;
    label: string;
  },
) {
  ensureSpace(doc, 34);
  const y = doc.y;

  doc.roundedRect(pageMargin, y, contentWidth(doc), 28, 3).fillAndStroke("#ffffff", borderColor);
  doc.font("Helvetica").fontSize(8).fillColor("#111827");
  doc.text(row.studentName, pageMargin + 8, y + 7, { width: 142, ellipsis: true });
  doc.text(row.churchName, pageMargin + 154, y + 7, { width: 112, ellipsis: true });
  doc.text(getCategoryLabel(row.category), pageMargin + 272, y + 7, { width: 70, ellipsis: true });
  doc.text(formatPercent(row.percent), pageMargin + 348, y + 7, { width: 58 });
  doc.font("Helvetica-Bold").fillColor(row.passed ? successColor : dangerColor);
  doc.text(row.label, pageMargin + 414, y + 7, { width: 72 });
  doc.y = y + 34;
}

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);
    doc.font("Helvetica").fontSize(8).fillColor(mutedColor);
    doc.text(`Pagina ${index + 1} de ${range.count}`, pageMargin, doc.page.height - doc.page.margins.bottom - 28, {
      align: "center",
      lineBreak: false,
      width: contentWidth(doc),
    });
  }
}

function getStatusLabel(status: string) {
  if (status === "SUBMITTED") return "Enviada";
  if (status === "EXPIRED") return "Expirada";
  return status;
}
