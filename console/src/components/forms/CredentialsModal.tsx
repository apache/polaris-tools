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

import { Copy, Check } from "lucide-react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CredentialsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credentials: { clientId: string; clientSecret: string } | null
}

export function CredentialsModal({
  open,
  onOpenChange,
  credentials,
}: CredentialsModalProps) {
  const [copiedId, setCopiedId] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  const copyToClipboard = async (text: string, type: "id" | "secret") => {
    await navigator.clipboard.writeText(text)
    if (type === "id") {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    } else {
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    }
  }

  const copyJsonToClipboard = async () => {
    if (!credentials) return
    const json = JSON.stringify(
      {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      },
      null,
      2
    )
    await navigator.clipboard.writeText(json)
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }

  if (!credentials) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Service Credentials</DialogTitle>
          <DialogDescription>
            Copy the service credentials below, they cannot be retrieved later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <div className="flex gap-2">
              <Input
                id="clientId"
                type="password"
                value={credentials.clientId}
                readOnly
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(credentials.clientId, "id")}
              >
                {copiedId ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <div className="flex gap-2">
              <Input
                id="clientSecret"
                type="password"
                value={credentials.clientSecret}
                readOnly
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(credentials.clientSecret, "secret")}
              >
                {copiedSecret ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={copyJsonToClipboard}
            className="flex items-center gap-2"
          >
            {copiedJson ? (
              <>
                <Check className="h-4 w-4" />
                JSON Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy as JSON
              </>
            )}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

