"use client";
import type { ReactNode } from "react";
/** Formulaire qui demande une confirmation avant envoi (les opérations sensibles sont en plus journalisées côté serveur). */
export function ConfirmForm({ action, message, children, className }: { action: (fd: FormData) => void | Promise<void>; message: string; children: ReactNode; className?: string }) {
  return <form action={action} className={className} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</form>;
}
