import Link from "next/link";

const pillars = [
  {
    number: "01",
    title: "Distinct identities",
    body: "Each companion keeps its own role, system prompt, response style, model preference, and memory boundary.",
  },
  {
    number: "02",
    title: "Versioned character",
    body: "Prompt changes become immutable revisions, so a personality never mutates without leaving footprints.",
  },
  {
    number: "03",
    title: "Private by default",
    body: "The deployment accepts one configured owner and protects provider operations behind the application session.",
  },
  {
    number: "04",
    title: "Memory with receipts",
    body: "The next slice adds multi-chat conversation and source-backed recall on top of this identity foundation.",
  },
];

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">
          <span className="status-dot" />
          Identity foundation online
        </div>
        <h1>
          Your companions now have
          <span>stable identities.</span>
        </h1>
        <p>
          Create several companions, tune their behavior, preserve prompt history,
          and keep provider access behind a private owner account. Chats and
          cross-conversation memory are the next floor of the house.
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/companions">
            Create a companion
          </Link>
          <Link className="button secondary" href="/settings/providers">
            Connect Grok
          </Link>
        </div>
      </section>

      <section className="pillar-grid" aria-label="Current capabilities">
        {pillars.map((pillar) => (
          <article className="pillar-card" key={pillar.number}>
            <span>{pillar.number}</span>
            <h2>{pillar.title}</h2>
            <p>{pillar.body}</p>
          </article>
        ))}
      </section>

      <section className="split-panel">
        <div>
          <div className="eyebrow">Build sequence</div>
          <h2>The memory palace finally has a locked front door.</h2>
        </div>
        <div className="check-list">
          <p>
            <strong>Ready:</strong> owner auth, PostgreSQL, migrations, Grok OAuth,
            and companion CRUD
          </p>
          <p>
            <strong>Next:</strong> persistent chats, streamed responses, retry, and
            cancellation
          </p>
          <p>
            <strong>Then:</strong> summaries, structured memories, provenance, and
            genuine forgetting
          </p>
        </div>
      </section>
    </div>
  );
}
