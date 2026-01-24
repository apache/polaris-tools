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

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AuthProviderType, type AuthConfig } from "@/types/workspaces"

interface AuthProviderSelectorProps {
  authProviders: AuthConfig[]
  selectedProvider: AuthConfig | null
  onSelectProvider: (provider: AuthConfig) => void
}

function getAuthProviderLabel(provider: AuthConfig): string {
  const typeLabel = provider.type === AuthProviderType.INTERNAL ? "Internal" : "OIDC"

  try {
    const urlPart = provider.url ? ` (${new URL(provider.url).origin})` : ""
    return `${typeLabel}${urlPart}`
  } catch {
    return typeLabel
  }
}

export function AuthProviderSelector({
  authProviders,
  selectedProvider,
  onSelectProvider,
}: AuthProviderSelectorProps) {
  if (authProviders.length === 0) {
    return null
  }

  const selectedIndex = selectedProvider
    ? authProviders.findIndex((p) => p === selectedProvider)
    : 0

  return (
    <div className="space-y-2">
      <Label htmlFor="authProvider">Authentication Method</Label>
      <Select
        value={selectedIndex.toString()}
        onValueChange={(value) => {
          const index = parseInt(value, 10)
          if (authProviders[index]) {
            onSelectProvider(authProviders[index])
          }
        }}
      >
        <SelectTrigger id="authProvider">
          <SelectValue placeholder="Select authentication method" />
        </SelectTrigger>
        <SelectContent>
          {authProviders.map((provider, index) => (
            <SelectItem key={index} value={index.toString()}>
              {getAuthProviderLabel(provider)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
