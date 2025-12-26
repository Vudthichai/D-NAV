import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NudgeGoal } from "@/src/lib/dnav/nudges/types";

export type NudgeUISettings = {
  goal: NudgeGoal;
  minGoalImprovement: number;
  minDnav?: number;
  preventPressureIncrease: boolean;
  preventReturnDecrease: boolean;
  preventStabilityDecrease: boolean;
  allowUrgencyIncrease: boolean;
};

type Props = {
  settings: NudgeUISettings;
  onChange: (next: NudgeUISettings) => void;
};

const GOAL_OPTIONS: { value: NudgeGoal; label: string }[] = [
  { value: "increase-dnav", label: "Increase D-NAV" },
  { value: "increase-return", label: "Increase Return" },
  { value: "reduce-pressure", label: "Reduce Pressure" },
  { value: "increase-stability", label: "Increase Stability" },
];

export function NudgeControls({ settings, onChange }: Props) {
  const goalLabel = useMemo(() => GOAL_OPTIONS.find((option) => option.value === settings.goal)?.label, [settings.goal]);

  const update = (partial: Partial<NudgeUISettings>) => {
    onChange({ ...settings, ...partial });
  };

  const handleNumberChange = (value: string, key: "minGoalImprovement" | "minDnav") => {
    if (value === "") {
      update({ [key]: undefined } as Partial<NudgeUISettings>);
      return;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      update({ [key]: parsed } as Partial<NudgeUISettings>);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/40 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nudge settings</p>
        <p className="text-sm text-muted-foreground">Tune the goal and guardrails for the suggested nudge.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goal</p>
          <Select value={settings.goal} onValueChange={(value) => update({ goal: value as NudgeGoal })}>
            <SelectTrigger>
              <SelectValue placeholder="Select goal" />
            </SelectTrigger>
            <SelectContent>
              {GOAL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Improve goal by at least</p>
          <Input
            type="number"
            inputMode="decimal"
            value={settings.minGoalImprovement ?? 1}
            onChange={(event) => handleNumberChange(event.target.value, "minGoalImprovement")}
            min={0}
            step="0.5"
          />
          <p className="text-xs text-muted-foreground">{goalLabel ? `${goalLabel} improvement target (default 1).` : "Minimum improvement target."}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Constraints</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={settings.preventPressureIncrease}
                onCheckedChange={(checked) => update({ preventPressureIncrease: Boolean(checked) })}
              />
              Don&apos;t increase Pressure
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={settings.preventReturnDecrease}
                onCheckedChange={(checked) => update({ preventReturnDecrease: Boolean(checked) })}
              />
              Don&apos;t decrease Return
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={settings.preventStabilityDecrease}
                onCheckedChange={(checked) => update({ preventStabilityDecrease: Boolean(checked) })}
              />
              Don&apos;t decrease Stability
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thresholds</p>
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Keep D-NAV at least</p>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Optional"
                value={settings.minDnav ?? ""}
                onChange={(event) => handleNumberChange(event.target.value, "minDnav")}
                min={0}
                step="0.5"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Allow urgency increases</p>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={settings.allowUrgencyIncrease}
                  onCheckedChange={(checked) => update({ allowUrgencyIncrease: Boolean(checked) })}
                />
                Enable urgency-up nudges (opt-in)
              </label>
              <p className="text-xs text-muted-foreground">Urgency-up is usually stress-inducing; keep opt-in.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NudgeControls;
