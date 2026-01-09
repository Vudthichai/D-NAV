"use client";

import { ReactNode } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
}

export default function Portal({ children }: PortalProps) {
  const mounted = typeof window !== "undefined" && typeof document !== "undefined";

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}
