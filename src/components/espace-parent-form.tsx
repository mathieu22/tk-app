"use client";
// Formulaire parent (création / modification), US-7.1.
import { useActionState } from "react";
import { saveParent } from "@/app/actions/parents";
import { FormTopBar } from "./ui";

export function EspaceParentForm({ parent, members, relationships, cancelHref }: {
  parent?: { id: string; lastName: string; firstName: string; phone: string; email: string | null };
  members?: { id: string; name: string }[];
  relationships: Record<string, string>;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveParent, undefined);
  const v = state?.values ?? {};
  const e = state?.errors ?? {};
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, optional = false) => (
    <div>
      <label className="gph-label" htmlFor={name}>{label} {optional && <span className="opt">(optionnel)</span>}</label>
      <input id={name} name={name} className="gph-input" aria-invalid={!!e[name]}
        defaultValue={v[name] ?? (parent?.[name as keyof typeof parent] as string | undefined) ?? ""} {...props} />
      {e[name] && <p className="mt-1.5 text-xs font-semibold text-danger">{e[name]}</p>}
    </div>
  );
  return (
    <form action={action}>
      <FormTopBar cancelHref={cancelHref} title={parent ? "Modifier le parent" : "Nouveau parent"}
        action={<button className="text-[15px] font-bold text-primary" disabled={pending}>Enregistrer</button>} />
      {parent && <input type="hidden" name="id" value={parent.id} />}
      <div className="flex flex-col gap-3.5 px-4 lg:max-w-2xl">
        <div className="grid gap-3.5 sm:grid-cols-2">
          {field("lastName", "Nom", { required: true, autoCapitalize: "characters" })}
          {field("firstName", "Prénom", { required: true })}
        </div>
        {field("phone", "Téléphone", { required: true, type: "tel", inputMode: "tel", placeholder: "+261 34 12 345 67" })}
        {field("email", "Email", { type: "email" }, true)}
        {members && (
          <fieldset className="gph-card flex flex-col gap-3 p-3.5">
            <legend className="px-1 text-[13px] font-bold">Associer à un athlète <span className="font-medium text-ink-3">(optionnel)</span></legend>
            <select name="memberId" defaultValue={v.memberId ?? ""} className="gph-input">
              <option value="">— Aucun —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <select name="relationship" defaultValue={v.relationship ?? "MOTHER"} className="gph-input" aria-label="Lien de parenté">
                {Object.entries(relationships).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select name="rank" defaultValue={v.rank ?? "1"} className="gph-input" aria-label="Rang du tuteur">
                <option value="1">Tuteur 1 (principal)</option>
                <option value="2">Tuteur 2</option>
              </select>
            </div>
          </fieldset>
        )}
        <button className="gph-btn-primary full mt-2" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}
