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

import {
  CheckCircle2,
  AlertCircle,
  Circle,
  Copy,
  Loader2,
  SkipForward,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DialogFooter } from "@/components/ui/dialog"
import type { SetupStep, SetupResult } from "@/lib/setup-executor"

// ---------------------------------------------------------------------------
// StepList — shared progress list used by ApplyStep and DoneStep
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<SetupStep["status"], React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  skipped: <SkipForward className="h-4 w-4 text-yellow-500" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
}

interface StepListProps {
  steps: SetupStep[]
}

export function StepList({ steps }: StepListProps) {
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-md border p-3">
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5 shrink-0">{STATUS_ICON[step.status]}</span>
          <span className={step.status === "error" ? "text-destructive" : ""}>
            {step.label}
            {step.status === "skipped" && step.error && (
              <span className="text-muted-foreground text-xs"> — {step.error}</span>
            )}
            {step.status === "error" && step.error && (
              <span className="block text-xs text-muted-foreground">
                {typeof step.error === "string" ? step.error : JSON.stringify(step.error)}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ApplyStep
// ---------------------------------------------------------------------------

interface ApplyStepProps {
  steps: SetupStep[]
  isApplying: boolean
}

export function ApplyStep({ steps, isApplying }: ApplyStepProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isApplying && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>{isApplying ? "Setting up your Polaris environment…" : "Finishing up…"}</span>
      </div>
      <StepList steps={steps} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// DoneStep
// ---------------------------------------------------------------------------

interface DoneStepProps {
  steps: SetupStep[]
  result: SetupResult
  onDone: () => void
}

export function DoneStep({ steps, result, onDone }: DoneStepProps) {
  const hasErrors = steps.some((s) => s.status === "error" || s.status === "pending")
  const counts = steps.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  const {
    done: doneCount = 0,
    skipped: skippedCount = 0,
    error: errorCount = 0,
    pending: pendingCount = 0,
  } = counts
  const totalResolved = doneCount + skippedCount + errorCount

  return (
    <>
      <div className="space-y-4">
        <div
          className={`flex items-center gap-2 ${hasErrors ? "text-yellow-600" : "text-green-600"}`}
        >
          {hasErrors ? (
            <AlertCircle className="h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          )}
          <span className="font-medium text-sm">
            {pendingCount > 0
              ? `Setup stopped early — ${doneCount} created, ${skippedCount} skipped, ${errorCount} failed, ${pendingCount} not reached`
              : hasErrors
                ? `Setup finished with errors — ${doneCount} created, ${skippedCount} skipped, ${errorCount} failed`
                : `Setup complete — ${doneCount} created, ${skippedCount} skipped (${totalResolved} total)`}
          </span>
        </div>

        <StepList steps={steps} />

        {result.credentials.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Credentials{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (save these now — they won&apos;t be shown again)
              </span>
            </p>
            {result.credentials.map((cred) => (
              <CredentialsCard key={cred.principalName} cred={cred} />
            ))}
          </div>
        )}
      </div>
      <DialogFooter className="sticky bottom-0 bg-background pt-4 mt-4 border-t">
        <Button onClick={onDone}>Close</Button>
      </DialogFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// CredentialsCard — only used by DoneStep
// ---------------------------------------------------------------------------

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <code className="text-xs bg-background rounded px-1.5 py-0.5 flex-1 truncate">{value}</code>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => navigator.clipboard.writeText(value).catch(() => null)}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

interface CredentialsCardProps {
  cred: SetupResult["credentials"][number]
}

function CredentialsCard({ cred }: CredentialsCardProps) {
  return (
    <Card className="bg-muted/50 border">
      <CardContent className="pt-4 space-y-2 text-sm">
        <p className="font-medium">{cred.principalName}</p>
        <CredentialRow label="Client ID:" value={cred.clientId} />
        <CredentialRow label="Client Secret:" value={cred.clientSecret} />
      </CardContent>
    </Card>
  )
}
