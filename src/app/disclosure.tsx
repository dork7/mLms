"use client";
// A section of a page that stays folded until the person opens it, such as a long add form
// under a list. It remembers being opened, so a save that re-renders the page from the
// server doesn't fold it away again.
import { type ReactNode, useState } from "react";

export function Disclosure({
  show,
  hide,
  initiallyOpen,
  children,
}: {
  /** The summary while folded, and while open. */
  show: string;
  hide: string;
  initiallyOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details className="disclosure" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{open ? hide : show}</summary>
      {children}
    </details>
  );
}
