import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/companions", label: "Companions" },
  { href: "/chats", label: "Chats" },
  { href: "/memory", label: "Memory" },
  { href: "/settings/providers", label: "Providers" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="AI Companion home">
          <span className="brand-mark" aria-hidden="true">
            ◌
          </span>
          <span>
            <strong>AI Companion</strong>
            <small>Personal, persistent, inspectable</small>
          </span>
        </Link>

        <nav aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main>{children}</main>

      <footer>
        <span>Foundation 0.1</span>
        <span>Local-first until application authentication lands.</span>
      </footer>
    </div>
  );
}
