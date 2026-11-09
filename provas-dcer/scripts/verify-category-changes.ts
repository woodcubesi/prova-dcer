import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Category } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { CategoryChangeError, changeStudentCategory } from "../src/lib/student-category";
import { getCorrectionQuestions } from "../src/lib/questions";

async function main() {
  const rollback = new Error("ROLLBACK_VERIFICATION_FIXTURES");
  try {
    await prisma.$transaction(async (tx) => {
      const suffix = randomUUID();
      const church = await tx.church.create({ data: { name: `Category verification ${suffix}` } });
      const student = await tx.student.create({
        data: { name: "Verification", normalizedName: suffix, churchId: church.id, category: Category.JUNIOR },
      });
      const event = await tx.event.create({ data: { title: `Verification ${suffix}` } });
      const registration = await tx.eventRegistration.create({
        data: {
          eventId: event.id, studentId: student.id, churchId: church.id,
          registrationCode: suffix, name: student.name, normalizedName: suffix,
          category: student.category, leaderName: "Verification",
        },
      });
      for (const category of [Category.ADOLESCENTES, Category.JUVENIL, Category.JUNIOR, Category.JUVENIL, Category.ADOLESCENTES, Category.JUNIOR]) {
        await changeStudentCategory(tx, student.id, category);
        assert.equal((await tx.student.findUniqueOrThrow({ where: { id: student.id } })).category, category);
        assert.equal((await tx.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } })).category, category);
      }
      await tx.student.create({
        data: { name: student.name, normalizedName: suffix, churchId: church.id, category: Category.JUVENIL },
      });
      await assert.rejects(changeStudentCategory(tx, student.id, Category.JUVENIL), CategoryChangeError);
      assert.equal((await tx.student.findUniqueOrThrow({ where: { id: student.id } })).category, Category.JUNIOR);

      const exam = await tx.exam.create({ data: { title: "Verification" } });
      const application = await tx.examApplication.create({ data: { examId: exam.id, title: "Verification", accessCode: suffix } });
      const attempt = await tx.attempt.create({
        data: { applicationId: application.id, eventRegistrationId: registration.id, expiresAt: new Date(Date.now() + 60000) },
      });
      await assert.rejects(changeStudentCategory(tx, student.id, Category.ADOLESCENTES), CategoryChangeError);
      await tx.attempt.update({ where: { id: attempt.id }, data: { status: "SUBMITTED", score: 1, totalPoints: 1 } });
      await changeStudentCategory(tx, student.id, Category.ADOLESCENTES);
      assert.equal((await tx.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).score, 1);
      throw rollback;
    }, { timeout: 20000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  const questions = [{ id: "original", category: "JUNIOR", active: true }, { id: "other", category: "JUVENIL", active: true }];
  assert.deepEqual(getCorrectionQuestions(questions, [{ questionId: "original" }], "JUVENIL"), [questions[0]]);
  console.log("OK: seis transicoes, sincronizacao, duplicidade, prova em andamento e historico. Dados de teste revertidos.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
