"use client";

import { useEffect } from "react";

function calculateAge(birthDate: Date, referenceDate: Date) {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = referenceDate.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function getCategoryFromBirthDate(value: string) {
  if (!value) return "";

  const birthDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(birthDate.getTime())) return "";

  const age = calculateAge(birthDate, new Date());

  if (age >= 8 && age < 12) return "JUNIOR";
  if (age >= 12 && age < 15) return "ADOLESCENTES";
  if (age >= 15 && age < 18) return "JUVENIL";

  return "";
}

export function StudentCategoryAutoSelect() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>('form[data-student-profile-form="true"]');
    const birthDateInput = form?.querySelector<HTMLInputElement>('input[name="birthDate"]');
    const categorySelect = form?.querySelector<HTMLSelectElement>('select[name="category"]');

    if (!birthDateInput || !categorySelect) return;

    const input = birthDateInput;
    const select = categorySelect;

    function updateCategory() {
      const nextCategory = getCategoryFromBirthDate(input.value);

      if (!nextCategory || select.value === nextCategory) return;

      select.value = nextCategory;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    input.addEventListener("input", updateCategory);
    input.addEventListener("change", updateCategory);

    return () => {
      input.removeEventListener("input", updateCategory);
      input.removeEventListener("change", updateCategory);
    };
  }, []);

  return null;
}
