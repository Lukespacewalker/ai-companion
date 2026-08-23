import type { Metadata } from "next";
import { CompanionManager } from "@/components/companion-manager";
import { listCompanions } from "@/features/companions/repository";
import { requireOwnerPage } from "@/lib/owner";

export const metadata: Metadata = { title: "Companions" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CompanionsPage() {
  const owner = await requireOwnerPage();
  const companions = await listCompanions(owner.user.id);

  return (
    <div className="page-stack">
      <section className="page-heading companion-heading">
        <div>
          <div className="eyebrow">Identity studio</div>
          <h1>Companions</h1>
          <p>
            Build several distinct relationships without blending their instructions
            or private context. Every prompt change becomes a numbered revision.
          </p>
        </div>
      </section>

      <CompanionManager initial={companions} />
    </div>
  );
}
