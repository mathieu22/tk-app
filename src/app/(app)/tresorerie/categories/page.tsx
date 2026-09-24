import type { Metadata } from "next";
import { CategoryRow, NewCategoryForm } from "@/components/treasury-category-form";
import { TreasuryTabs } from "@/components/treasury-tabs";
import { ScreenHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Catégories de trésorerie" };

export default async function CategoriesPage() {
  const user = await requirePermission("treasury.manage");
  const [categories, pending] = await Promise.all([
    db.operationCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { operations: true } } } }),
    db.operation.count({ where: { status: "PENDING", cancelled: false } }),
  ]);
  return (
    <>
      <ScreenHeader title="Catégories" sub="Recettes et dépenses" />
      <div className="px-4">
        <TreasuryTabs active="categories" user={user} pending={pending} />
        <div className="grid gap-4 md:grid-cols-2">
          {(["INCOME", "EXPENSE"] as const).map((type) => (
            <section key={type}>
              <h2 className="mb-2 px-1 text-[15px] font-bold">{type === "INCOME" ? "Recettes" : "Dépenses"}</h2>
              <div className="gph-card mb-2 divide-y divide-[var(--gph-divider)] p-0">
                {categories.filter((c) => c.type === type).map((c) => (
                  <CategoryRow key={c.id} id={c.id} name={c.name} type={c.type} system={c.system} used={c._count.operations} />
                ))}
              </div>
              <NewCategoryForm type={type} />
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
