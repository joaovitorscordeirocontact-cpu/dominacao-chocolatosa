"use client";

import { useEffect, useState } from "react";

/** Para ações sem volta: o primeiro toque pede confirmação, o segundo executa. */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  disabled = false,
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!asking) return;
    // Ignora o segundo toque de um toque duplo acidental.
    const arm = setTimeout(() => setReady(true), 450);
    const giveUp = setTimeout(() => setAsking(false), 8_000);
    return () => {
      clearTimeout(arm);
      clearTimeout(giveUp);
      setReady(false);
    };
  }, [asking]);

  if (!asking) {
    return (
      <button type="button" className={className} disabled={disabled} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Confirmar ação">
      <button
        type="button"
        className="btn btn-gold"
        disabled={disabled}
        aria-disabled={!ready}
        autoFocus
        onClick={() => {
          if (!ready) return;
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn btn-ghost min-h-11! text-sm" onClick={() => setAsking(false)}>
        Cancelar
      </button>
    </div>
  );
}
