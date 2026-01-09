"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import DefinitionsPanel from "@/components/stress-test/DefinitionsPanel";

type DefinitionsPanelContextValue = {
  defsOpen: boolean;
  openDefinitions: (trigger?: HTMLButtonElement | null) => void;
  closeDefinitions: () => void;
};

const DefinitionsPanelContext = createContext<DefinitionsPanelContextValue | null>(null);

export function DefinitionsPanelProvider({ children }: { children: React.ReactNode }) {
  const [defsOpen, setDefsOpen] = useState(false);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const openDefinitions = useCallback((trigger?: HTMLButtonElement | null) => {
    lastTriggerRef.current = trigger ?? null;
    setDefsOpen(true);
  }, []);

  const closeDefinitions = useCallback(() => {
    setDefsOpen(false);
    queueMicrotask(() => {
      lastTriggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!defsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDefinitions();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [defsOpen, closeDefinitions]);

  const value = useMemo(
    () => ({ defsOpen, openDefinitions, closeDefinitions }),
    [defsOpen, openDefinitions, closeDefinitions],
  );

  return (
    <DefinitionsPanelContext.Provider value={value}>
      {children}
      <DefinitionsPanel open={defsOpen} onClose={closeDefinitions} />
    </DefinitionsPanelContext.Provider>
  );
}

export function useDefinitionsPanel() {
  const context = useContext(DefinitionsPanelContext);
  if (!context) {
    throw new Error("useDefinitionsPanel must be used within DefinitionsPanelProvider");
  }
  return context;
}
