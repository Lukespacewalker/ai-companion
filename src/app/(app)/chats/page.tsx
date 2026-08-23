import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Chats" };

export default function ChatsPage() {
  return (
    <div className="page-stack narrow">
      <section className="page-heading">
        <div className="eyebrow">Next implementation slice</div>
        <h1>Chats</h1>
        <p>
          Persistent conversation threads will sit beneath each companion, with
          streamed Grok responses, retries, cancellation, titles, and compact
          current-thread summaries.
        </p>
      </section>

      <section className="empty-state">
        <span className="empty-glyph" aria-hidden="true">
          ↗
        </span>
        <h2>Give the speakers a stage</h2>
        <p>
          The identity and prompt-versioning layer is ready. Create at least one
          companion now; the next pull request wires those identities into durable
          chats.
        </p>
        <Link className="button primary" href="/companions">
          Open companions
        </Link>
      </section>
    </div>
  );
}
