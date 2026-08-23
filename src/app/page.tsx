import Link from "next/link";

const pillars = [
  {
    number: "01",
    title: "Many companions",
    body: "Give each companion its own role, voice, system prompt, model, and memory boundary.",
  },
  {
    number: "02",
    title: "Many conversations",
    body: "Keep separate threads without dissolving every topic into one endless context soup.",
  },
  {
    number: "03",
    title: "Source-backed memory",
    body: "Recall useful facts across chats while preserving where each memory came from.",
  },
  {
    number: "04",
    title: "Real forgetting",
    body: "Inspect, correct, re-scope, or suppress memories instead of trusting an invisible black box.",
  },
];

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">
          <span className="status-dot" />
          MVP foundation
        </div>
        <h1>
          Personal AI with a memory
          <span>you can actually inspect.</span>
        </h1>
        <p>
          Create distinct companions, keep many chats, and carry the right context
          across conversations without handing the model your entire digital attic.
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/settings/providers">
            Connect Grok
          </Link>
          <Link className="button secondary" href="/companions">
            View companion plan
          </Link>
        </div>
      </section>

      <section className="pillar-grid" aria-label="Product pillars">
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
          <div className="eyebrow">Current slice</div>
          <h2>The front door is being built before the memory palace.</h2>
        </div>
        <div className="check-list">
          <p><strong>Ready:</strong> Next.js shell and Grok device OAuth foundation</p>
          <p><strong>Next:</strong> application auth, PostgreSQL, and companion CRUD</p>
          <p><strong>Then:</strong> chat streaming, summaries, and provenance-first memory</p>
        </div>
      </section>
    </div>
  );
}
