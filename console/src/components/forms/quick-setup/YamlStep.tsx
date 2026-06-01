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

import { useState, useEffect, useRef } from "react"
import { load as parseYaml } from "js-yaml"
import { CheckCircle2, AlertCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DialogFooter } from "@/components/ui/dialog"
import type { SetupConfig } from "@/types/setup-config"

type ParseResult = { config: SetupConfig; entityCount: number } | { error: string }

interface Props {
  onBack: () => void
  onNext: (config: SetupConfig) => void
}

function parseConfig(text: string): ParseResult {
  try {
    const parsed = parseYaml(text)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "YAML must be a mapping object (not a list or scalar)" }
    }
    const cfg = parsed as SetupConfig
    const entityCount =
      (cfg.principal_roles?.length ?? 0) +
      Object.keys(cfg.principals ?? {}).length +
      (cfg.catalogs?.length ?? 0)
    if (entityCount === 0) {
      return { error: "No principal_roles, principals, or catalogs found" }
    }
    return { config: cfg, entityCount }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export function YamlStep({ onBack, onNext }: Props) {
  const [text, setText] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)

  useEffect(() => {
    if (!text.trim()) {
      setParseResult(null)
      return
    }
    setParseResult(parseConfig(text))
  }, [text])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(reader.result as string)
    reader.readAsText(file)
    e.target.value = ""
  }

  const valid = parseResult && "config" in parseResult

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted-foreground">Paste a YAML config.</p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-3.5 w-3.5" />
            Upload File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        <div className="rounded-lg bg-muted/40 p-4 space-y-2">
          <Textarea
            className="font-mono text-xs min-h-56 resize-y bg-background border-border"
            placeholder={
              "principal_roles:\n  - my_role\nprincipals:\n  my_user:\n    roles:\n      - my_role\ncatalogs:\n  - name: my_catalog\n    storage_type: file\n    ..."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {parseResult && (
            <div
              className={`flex items-center gap-2 text-sm ${valid ? "text-green-600" : "text-destructive"}`}
            >
              {valid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Valid — {(parseResult as { entityCount: number }).entityCount} top-level
                    entities detected
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="truncate">{(parseResult as { error: string }).error}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <DialogFooter className="sticky bottom-0 bg-background pt-4 mt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={!valid}
          onClick={() => onNext((parseResult as { config: SetupConfig }).config)}
        >
          Preview →
        </Button>
      </DialogFooter>
    </>
  )
}
