import type { Metadata } from "next";

export const metadata: Metadata = { title: "Memory" };

export default function MemoryPage() {
  return (
    <div className="page-stack narrow">
      <section className="page-heading">
        <div className="eyebrow">Milestone 5</div>
        <h1>Memory</h1>
        <p>
          Memories will be structured, scoped, source-backed, editable, and
          suppressible after a forget action.
        </p>
      </section>

      <section className="empty-state">
        <span className="empty-glyph" aria-hidden="true">◎</span>
        <h2>Nothing has been remembered</h2>
        <p>That is currently accurate, not amnesia.</p>
      </section>
    </div>
  );
}
