type QuestionWithAudience = {
  active?: boolean;
  category?: string | null;
};

export function isQuestionAvailableForCategory(question: QuestionWithAudience, category: string) {
  return question.active !== false && (!question.category || question.category === category);
}

export function filterQuestionsForCategory<T extends QuestionWithAudience>(questions: T[], category: string) {
  return questions.filter((question) => isQuestionAvailableForCategory(question, category));
}

export function getCorrectionQuestions<T extends QuestionWithAudience & { id: string }>(
  questions: T[],
  answers: { questionId: string }[],
  category: string,
) {
  // Submitted answers preserve the original question set after a category change.
  if (answers.length > 0) {
    const answeredIds = new Set(answers.map((answer) => answer.questionId));
    return questions.filter((question) => answeredIds.has(question.id));
  }
  return filterQuestionsForCategory(questions, category);
}

export function totalQuestionPointsForCategory<T extends QuestionWithAudience & { points: number }>(
  questions: T[],
  category: string,
) {
  return filterQuestionsForCategory(questions, category).reduce((sum, question) => sum + question.points, 0);
}
