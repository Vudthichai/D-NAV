"use client";

import DatasetSelect from "@/components/DatasetSelect";
import { useDataset } from "@/components/DatasetProvider";
import { useDefinitionsPanel } from "@/components/definitions/DefinitionsPanelProvider";
import { Button } from "@/components/ui/button";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";

export default function DatasetPickerRow() {
  const { openDefinitions } = useDefinitionsPanel();
  const { isLoggedIn, logout } = useNetlifyIdentity();
  const { addDataset } = useDataset();

  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <div className="dnav-glass-panel flex items-center gap-2 px-2 py-1">
        <DatasetSelect
          label="Dataset"
          triggerSize="sm"
          triggerClassName="min-w-[190px] text-xs"
          labelClassName="text-[10px]"
        />
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium" onClick={addDataset}>
          Add
        </Button>
      </div>
      <Button size="sm" onClick={(event) => openDefinitions(event.currentTarget)} className="font-semibold">
        Definitions
      </Button>
      {isLoggedIn ? (
        <button
          type="button"
          onClick={logout}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Log out
        </button>
      ) : null}
    </div>
  );
}
