import { updateParticipantCategoryAction } from "@/app/actions/admin";
import { CATEGORIES } from "@/lib/categories";

type ParticipantCategoryFormProps = {
  category: string;
  applicationId?: string;
  studentId?: string;
  eventId?: string;
  registrationId?: string;
};

export function ParticipantCategoryForm(props: ParticipantCategoryFormProps) {
  return (
    <form action={updateParticipantCategoryAction} className="flex flex-wrap items-center gap-2">
      {props.applicationId ? <input type="hidden" name="applicationId" value={props.applicationId} /> : null}
      {props.studentId ? <input type="hidden" name="studentId" value={props.studentId} /> : null}
      {props.eventId ? <input type="hidden" name="eventId" value={props.eventId} /> : null}
      {props.registrationId ? <input type="hidden" name="registrationId" value={props.registrationId} /> : null}
      <label>
        <span className="sr-only">Categoria do cadastro</span>
        <select name="category" defaultValue={props.category} className="rounded-md border border-[#c5cce4] bg-white px-3 py-2 text-sm">
          {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
      </label>
      <button className="rounded-md border border-[#000060] px-3 py-2 text-sm font-semibold text-[#000060]">Salvar categoria</button>
    </form>
  );
}
