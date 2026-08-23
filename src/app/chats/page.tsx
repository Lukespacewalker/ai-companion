import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chats" };

export default function ChatsPage() {
  return (
    <div className="page-stack narrow">
      <section className="page-heading">
        <div className="eyebrow">Milestone 4</div>
        <h1>Chats</h1>
        <p>
          Each companion will support many independent threads with streamed replies,
          retries, aborts, summaries, and prompt-version traces.
        </p>
      </section>

      <section className="empty-state">
        <span className="empty-glyph" aria-hidden="true">↯</span>
        <h2>The conversation archive is empty</h2>
        <p>The provider connection is being established first.</p>
      </section>
    </div>
  );
}
