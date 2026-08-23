import type { Metadata } from "next";

export const metadata: Metadata = { title: "Companions" };

export default function CompanionsPage() {
  return (
    <div className="page-stack narrow">
      <section className="page-heading">
        <div className="eyebrow">Milestone 3</div>
        <h1>Companions</h1>
        <p>
          This screen will manage companion identity, prompt versions, model choice,
          response style, and memory boundaries.
        </p>
      </section>

      <section className="empty-state">
        <span className="empty-glyph" aria-hidden="true">✦</span>
        <h2>No companions yet</h2>
        <p>
          Companion persistence follows application authentication and PostgreSQL in
          the next implementation milestone.
        </p>
      </section>
    </div>
  );
}
