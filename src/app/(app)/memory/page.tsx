import type { Metadata } from "next";

export const metadata: Metadata = { title: "Memory" };

export default function MemoryPage() {
  return (
    <div className="page-stack narrow">
      <section className="page-heading">
        <div className="eyebrow">Provenance-first recall</div>
        <h1>Memory</h1>
        <p>
          This area will hold confirmed facts, inferred candidates, source messages,
          scope controls, contradictions, and forget suppressions. Nothing should be
          remembered merely because a model sounded confident.
        </p>
      </section>

      <section className="empty-state">
        <span className="empty-glyph" aria-hidden="true">
          ◎
        </span>
        <h2>No memories yet</h2>
        <p>
          Memory extraction begins after persistent chats land. The current companion
          model already records each identity&apos;s intended memory boundary and
          instructions.
        </p>
      </section>
    </div>
  );
}
