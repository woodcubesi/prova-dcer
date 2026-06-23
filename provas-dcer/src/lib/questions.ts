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

export function totalQuestionPointsForCategory<T extends QuestionWithAudience & { points: number }>(
  questions: T[],
  category: string,
) {
  return filterQuestionsForCategory(questions, category).reduce((sum, question) => sum + question.points, 0);
}
