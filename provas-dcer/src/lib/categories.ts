export const CATEGORIES = [
  { value: "JUNIOR", label: "Junior" },
  { value: "ADOLESCENTES", label: "Adolescentes" },
  { value: "JUVENIL", label: "Juvenil" },
] as const;

export type CategoryCode = (typeof CATEGORIES)[number]["value"];

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  JUNIOR: "Junior",
  ADOLESCENTES: "Adolescentes",
  JUVENIL: "Juvenil",
};

export function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category as CategoryCode] ?? category;
}
