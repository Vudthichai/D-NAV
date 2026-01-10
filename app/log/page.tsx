import { Suspense } from "react";

import LogContent from "./LogContent";

export default function LogPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <LogContent />
    </Suspense>
  );
}
