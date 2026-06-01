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

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buildSteps, executeSetup, type SetupStep, type SetupResult } from "@/lib/setup-executor"
import { PRESETS, type Preset } from "@/lib/setup-presets"
import type { SetupConfig } from "@/types/setup-config"
import { ModeStep, PresetStep, ParamsStep, ReviewStep } from "./quick-setup/setup-steps"
import { YamlStep } from "./quick-setup/YamlStep"
import { ApplyStep, DoneStep } from "./quick-setup/progress-steps"

type WizardStep = "mode" | "preset" | "params" | "yaml" | "review" | "applying" | "done"

const DIALOG_TITLES: Record<WizardStep, string> = {
  mode: "Quick Setup",
  preset: "Choose a Preset",
  params: "Configure Storage",
  yaml: "Paste Custom YAML",
  review: "Review Actions",
  applying: "Applying Configuration",
  done: "Setup Complete",
}

interface QuickSetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickSetupWizard({ open, onOpenChange }: QuickSetupWizardProps) {
  const queryClient = useQueryClient()

  const [step, setStep] = useState<WizardStep>("mode")
  const [mode, setMode] = useState<"preset" | "yaml">("preset")
  const [selectedPreset, setSelectedPreset] = useState<Preset>(PRESETS[0])
  const [params, setParams] = useState<Record<string, string>>({})
  const [config, setConfig] = useState<SetupConfig | null>(null)
  const [applySteps, setApplySteps] = useState<SetupStep[]>([])
  const [result, setResult] = useState<SetupResult | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  const reset = () => {
    setStep("mode")
    setMode("preset")
    setSelectedPreset(PRESETS[0])
    setParams({})
    setConfig(null)
    setApplySteps([])
    setResult(null)
    setIsApplying(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isApplying) return
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  const handleSelectMode = (m: "preset" | "yaml") => {
    setMode(m)
    setStep(m === "preset" ? "preset" : "yaml")
  }

  const loadConfig = (preset: Preset, p: Record<string, string>) => {
    const resolved = preset.buildConfig(p)
    setConfig(resolved)
    setApplySteps(buildSteps(resolved))
    setStep("review")
  }

  const handleNextFromPreset = () => {
    if (selectedPreset.params.length > 0) {
      setStep("params")
      return
    }
    loadConfig(selectedPreset, {})
  }

  const handleNextFromParams = () => loadConfig(selectedPreset, params)

  const handleNextFromYaml = (parsed: SetupConfig) => {
    setConfig(parsed)
    setApplySteps(buildSteps(parsed))
    setStep("review")
  }

  const handleApply = async () => {
    if (!config) return
    setStep("applying")
    setIsApplying(true)
    try {
      const setupResult = await executeSetup(config, setApplySteps)
      setResult(setupResult)
      queryClient.invalidateQueries()
    } catch (e) {
      toast.error("Setup failed", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsApplying(false)
      setStep("done")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{DIALOG_TITLES[step]}</DialogTitle>
          {step === "mode" && (
            <DialogDescription>
              Bootstrap a Polaris environment using a preset or your own YAML config.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === "mode" && <ModeStep onSelect={handleSelectMode} />}

          {step === "preset" && (
            <PresetStep
              selected={selectedPreset}
              onSelect={setSelectedPreset}
              onBack={() => setStep("mode")}
              onNext={handleNextFromPreset}
            />
          )}

          {step === "params" && (
            <ParamsStep
              preset={selectedPreset}
              params={params}
              onChange={setParams}
              onBack={() => setStep("preset")}
              onNext={handleNextFromParams}
            />
          )}

          {step === "yaml" && (
            <YamlStep onBack={() => setStep("mode")} onNext={handleNextFromYaml} />
          )}

          {step === "review" && applySteps.length > 0 && (
            <ReviewStep
              steps={applySteps}
              onBack={() =>
                setStep(
                  mode === "yaml" ? "yaml" : selectedPreset.params.length > 0 ? "params" : "preset"
                )
              }
              onApply={handleApply}
            />
          )}

          {step === "applying" && <ApplyStep steps={applySteps} isApplying={isApplying} />}

          {(step === "done" || (step === "applying" && !isApplying)) && (
            <DoneStep
              steps={applySteps}
              result={result ?? { credentials: [] }}
              onDone={() => handleOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
