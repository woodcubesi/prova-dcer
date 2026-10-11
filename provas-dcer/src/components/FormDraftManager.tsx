"use client";

import { useEffect } from "react";

const storagePrefix = "provas-dcer:form-draft:";

type StoredControl =
  | {
      kind: "checkbox" | "radio";
      checked: boolean;
    }
  | {
      kind: "field";
      value: string;
    };

type StoredForm = {
  controls: Record<string, StoredControl[]>;
  savedAt: number;
};

function shouldSkipInput(input: HTMLInputElement) {
  return ["file", "hidden", "password", "submit", "button", "reset"].includes(input.type);
}

function getFormKey(form: HTMLFormElement, index: number) {
  const stableId = form.dataset.formDraftId || form.getAttribute("aria-label") || String(index);
  return `${storagePrefix}${window.location.pathname}:${stableId}`;
}

function collectForm(form: HTMLFormElement): StoredForm {
  const controls: StoredForm["controls"] = {};
  const elements = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input[name], textarea[name], select[name]",
  );

  elements.forEach((element) => {
    if (element instanceof HTMLInputElement && shouldSkipInput(element)) return;
    if (element.name.startsWith("$ACTION_")) return;

    const values = controls[element.name] || [];

    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      values.push({
        kind: element.type,
        checked: element.checked,
      });
    } else {
      values.push({
        kind: "field",
        value: element.value,
      });
    }

    controls[element.name] = values;
  });

  return {
    controls,
    savedAt: Date.now(),
  };
}

function restoreForm(form: HTMLFormElement, draft: StoredForm) {
  Object.entries(draft.controls).forEach(([name, storedControls]) => {
    const elements = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        `[name="${CSS.escape(name)}"]`,
      ),
    ).filter((element) => !(element instanceof HTMLInputElement && shouldSkipInput(element)));

    elements.forEach((element, index) => {
      const stored = storedControls[index];
      if (!stored) return;

      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        if (stored.kind === "checkbox" || stored.kind === "radio") {
          element.checked = stored.checked;
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }

      if (stored.kind === "field") {
        element.value = stored.value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });
}

export function FormDraftManager() {
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hasError = searchParams.has("erro");
    const hasSuccess =
      searchParams.has("ok") ||
      searchParams.has("criada") ||
      searchParams.get("senha") === "alterada" ||
      searchParams.get("mfa") === "redefinido";
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form"));

    if (hasSuccess) {
      forms.forEach((form, index) => window.localStorage.removeItem(getFormKey(form, index)));
    }

    if (hasError) {
      forms.forEach((form, index) => {
        const rawDraft = window.localStorage.getItem(getFormKey(form, index));
        if (!rawDraft) return;

        try {
          restoreForm(form, JSON.parse(rawDraft) as StoredForm);
        } catch {
          window.localStorage.removeItem(getFormKey(form, index));
        }
      });
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.formDraft === "off") return;

      const index = forms.indexOf(form);
      window.localStorage.setItem(getFormKey(form, index), JSON.stringify(collectForm(form)));
    }

    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, []);

  return null;
}
