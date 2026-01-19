"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EvidenceRef } from "@/components/stress-test/decision-intake-types";

interface EditDecisionModalProps {
  open: boolean;
  title: string;
  detail?: string;
  evidence: EvidenceRef;
  onTitleChange: (value: string) => void;
  onDetailChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditDecisionModal({
  open,
  title,
  detail,
  evidence,
  onTitleChange,
  onDetailChange,
  onSave,
  onClose,
}: EditDecisionModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Decision</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground">Decision title</label>
            <Input value={title} onChange={(event) => onTitleChange(event.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground">Decision detail</label>
            <Textarea
              value={detail ?? ""}
              onChange={(event) => onDetailChange(event.target.value)}
              rows={4}
              className="text-xs"
            />
          </div>
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="max-w-[240px] truncate text-xs font-semibold text-foreground">{evidence.fileName}</span>
              {evidence.pageNumber ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                  p.{evidence.pageNumber}
                </span>
              ) : null}
            </div>
            <div className="mt-2 line-clamp-3 whitespace-pre-wrap">{evidence.excerpt}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="h-8 px-3 text-xs" onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
