/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Wand2, FileCode2 } from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DialogFooter } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { PRESETS, type Preset } from "@/lib/setup-presets"
import type { SetupStep } from "@/lib/setup-executor"

// ---------------------------------------------------------------------------
// StepFooter — shared footer used by PresetStep, ParamsStep, and ReviewStep
// ---------------------------------------------------------------------------

function StepFooter({
  onBack,
  onNext,
  nextLabel = "Next →",
  disabled = false,
}: {
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  disabled?: boolean
}) {
  return (
    <DialogFooter className="sticky bottom-0 bg-background pt-4 mt-4 border-t">
      <Button variant="outline" onClick={onBack}>
        Back
      </Button>
      <Button onClick={onNext} disabled={disabled}>
        {nextLabel}
      </Button>
    </DialogFooter>
  )
}

// ---------------------------------------------------------------------------
// ModeStep
// ---------------------------------------------------------------------------

function ModeCard({
  icon: Icon,
  title,
  description,
  mode,
  onSelect,
}: {
  icon: React.ElementType
  title: string
  description: string
  mode: "preset" | "yaml"
  onSelect: (m: "preset" | "yaml") => void
}) {
  return (
    <Card
      className="cursor-pointer border-2 hover:border-primary transition-colors"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(mode)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(mode)}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

interface ModeStepProps {
  onSelect: (mode: "preset" | "yaml") => void
}

export function ModeStep({ onSelect }: ModeStepProps) {
  return (
    <div className="grid grid-cols-2 gap-4 py-2">
      <ModeCard
        icon={Wand2}
        title="Use a Preset"
        description="Pick from ready-made configurations. Great for getting started quickly."
        mode="preset"
        onSelect={onSelect}
      />
      <ModeCard
        icon={FileCode2}
        title="Use Custom YAML"
        description="Paste or upload a YAML config"
        mode="yaml"
        onSelect={onSelect}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// PresetStep
// ---------------------------------------------------------------------------

const STORAGE_LABELS: Record<Preset["storageType"], string> = {
  file: "Local File",
  s3: "AWS S3",
  azure: "Azure ADLS",
  gcs: "Google Cloud",
}

interface PresetStepProps {
  selected: Preset
  onSelect: (preset: Preset) => void
  onBack: () => void
  onNext: () => void
}

export function PresetStep({ selected, onSelect, onBack, onNext }: PresetStepProps) {
  return (
    <>
      <div className="space-y-2">
        {PRESETS.map((preset) => (
          <div
            key={preset.id}
            role="button"
            tabIndex={0}
            className={cn(
              "flex items-start justify-between rounded-lg border-2 p-4 cursor-pointer transition-colors",
              selected.id === preset.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/60"
            )}
            onClick={() => onSelect(preset)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(preset)}
          >
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{preset.label}</span>
                {preset.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {preset.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{preset.description}</p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              {STORAGE_LABELS[preset.storageType] ?? preset.storageType}
            </Badge>
          </div>
        ))}
      </div>
      <StepFooter onBack={onBack} onNext={onNext} />
    </>
  )
}

// ---------------------------------------------------------------------------
// ParamsStep
// ---------------------------------------------------------------------------

interface ParamsStepProps {
  preset: Preset
  params: Record<string, string>
  onChange: (params: Record<string, string>) => void
  onBack: () => void
  onNext: () => void
}

export function ParamsStep({ preset, params, onChange, onBack, onNext }: ParamsStepProps) {
  const allRequiredFilled = preset.params.every((p) => !p.required || !!params[p.key]?.trim())

  return (
    <>
      <div className="rounded-lg bg-muted/40 p-4 space-y-4">
        {preset.params.map((param) => (
          <div key={param.key} className="space-y-1.5">
            <Label htmlFor={param.key}>
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={param.key}
              placeholder={param.placeholder}
              value={params[param.key] ?? ""}
              className="bg-background border-border"
              onChange={(e) => onChange({ ...params, [param.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <StepFooter onBack={onBack} onNext={onNext} disabled={!allRequiredFilled} />
    </>
  )
}

// ---------------------------------------------------------------------------
// ReviewStep
// ---------------------------------------------------------------------------

interface ReviewStepProps {
  steps: SetupStep[]
  onBack: () => void
  onApply: () => void
}

export function ReviewStep({ steps, onBack, onApply }: ReviewStepProps) {
  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The following actions will be performed. Existing entities are skipped automatically.
        </p>
        <div className="rounded-md border max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => (
                <TableRow key={step.id}>
                  <TableCell className="text-sm">{step.label}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">{steps.length} action(s) planned</p>
      </div>
      <StepFooter onBack={onBack} onNext={onApply} nextLabel="Apply Configuration" />
    </>
  )
}
