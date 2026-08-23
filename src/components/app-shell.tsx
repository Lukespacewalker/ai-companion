import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/companions", label: "Companions" },
  { href: "/chats", label: "Chats" },
  { href: "/memory", label: "Memory" },
  { href: "/settings/providers", label: "Providers" },
];

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name: string; email: string };
}) {
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

        <div className="header-tools">
          <nav aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="owner-chip" title={user.email}>
            <span aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer>
        <span>Foundation 0.2</span>
        <span>Owner identity, PostgreSQL, and versioned companions are active.</span>
      </footer>
    </div>
  );
}
