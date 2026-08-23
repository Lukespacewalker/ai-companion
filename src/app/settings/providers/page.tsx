import type { Metadata } from "next";
import { GrokProviderCard } from "@/components/grok-provider-card";

export const metadata: Metadata = { title: "Providers" };

export default function ProvidersPage() {
  return (
    <div className="page-stack narrow">
      <section className="page-heading">
        <div className="eyebrow">Provider settings</div>
        <h1>Connect Grok</h1>
        <p>
          The OAuth-first mode delegates browser login, token storage, and refresh to
          the official Grok Build runtime.
        </p>
      </section>

      <GrokProviderCard />

      <section className="info-panel">
        <h2>Hosting boundary</h2>
        <p>
          This connection mode needs a persistent Node process, child-process access,
          and a private persistent <code>GROK_HOME</code>. It is designed for a
          personal self-hosted instance, not ephemeral serverless functions.
        </p>
      </section>
    </div>
  );
}
