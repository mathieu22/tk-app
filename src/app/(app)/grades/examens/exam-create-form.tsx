"use client";
import { useActionState } from "react";
import { createExam } from "@/app/actions/grades";

export function ExamCreateForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(createExam, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="gph-label" htmlFor="date">Date</label>
          <input id="date" name="date" type="date" required defaultValue={today} className="gph-input" />
          {e.date && <p className="mt-1 text-xs font-semibold text-danger">{e.date}</p>}
        </div>
        <div>
          <label className="gph-label" htmlFor="startTime">Heure <span className="opt">(opt.)</span></label>
          <input id="startTime" name="startTime" type="time" className="gph-input" />
        </div>
      </div>
      <div>
        <label className="gph-label" htmlFor="location">Lieu <span className="opt">(optionnel)</span></label>
        <input id="location" name="location" maxLength={120} className="gph-input" />
      </div>
      <div>
        <label className="gph-label" htmlFor="jury">Jury <span className="opt">(optionnel)</span></label>
        <input id="jury" name="jury" maxLength={300} placeholder="Maître Rakoto, …" className="gph-input" />
      </div>
      <label className="flex items-start gap-2 text-sm text-ink-2">
        <input type="checkbox" name="external" value="1" className="mt-1" />
        Examen poom / dan organisé par la fédération (résultats externes avec n° de certificat)
      </label>
      <p className="text-xs text-ink-3">Un examen du club crée automatiquement un événement « Passage de grade » (convocations et présence).</p>
      {state?.error && <p className="text-xs font-semibold text-danger">{state.error}</p>}
      <button className="gph-btn-primary full" disabled={pending}>Créer la session</button>
    </form>
  );
}
