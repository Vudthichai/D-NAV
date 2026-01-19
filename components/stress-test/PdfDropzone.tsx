"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, Upload } from "lucide-react";
import type { DragEvent } from "react";
import { useCallback, useRef, useState } from "react";
import type { IntakeFileStatus } from "@/components/stress-test/decision-intake-types";

interface PdfDropzoneFile {
  id: string;
  name: string;
  sizeBytes: number;
  progress?: number;
  warning?: string;
  status?: IntakeFileStatus;
}

interface PdfDropzoneProps {
  files: PdfDropzoneFile[];
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  disabled?: boolean;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function PdfDropzone({ files, onFilesAdded, onRemoveFile, disabled }: PdfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const next = Array.from(fileList);
      if (next.length === 0) return;
      onFilesAdded(next);
    },
    [onFilesAdded],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      handleFiles(event.dataTransfer.files);
    },
    [disabled, handleFiles],
  );

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-background/80 px-4 text-center text-sm text-foreground shadow-sm transition",
          isDragging ? "border-primary/70 bg-primary/5" : "hover:border-primary/60",
          disabled ? "opacity-60" : "cursor-pointer",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Upload className="h-4 w-4" />
          Drag & drop PDF
        </div>
        <p className="text-xs text-muted-foreground">Or click to browse · PDF only · 25MB max (soft)</p>
        <Button type="button" variant="outline" size="sm" className="pointer-events-none h-8 px-3 text-xs">
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      <div className="space-y-2">
        {files.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
            No PDF selected yet.
          </div>
        ) : null}
        {files.map((file) => (
          <div
            key={file.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs shadow-sm"
          >
            <div className="flex min-w-[140px] flex-1 items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold text-foreground">{file.name}</div>
                <div className="text-[11px] text-muted-foreground">{formatBytes(file.sizeBytes)}</div>
                {file.warning ? <div className="text-[11px] text-amber-500">{file.warning}</div> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {file.status ? (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    file.status === "extracted"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                      : file.status === "extracting"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                        : "border-border/60 bg-muted/20 text-muted-foreground",
                  )}
                >
                  {file.status}
                </span>
              ) : null}
              {typeof file.progress === "number" ? (
                <div className="h-2 w-24 overflow-hidden rounded-full bg-muted/40">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${file.progress}%` }} />
                </div>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveFile(file.id);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { PdfDropzoneFile };
