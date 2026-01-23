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

function getAuthProviderLabel(type: AuthProviderType): string {
  if (type === AuthProviderType.INTERNAL) {
    return "Internal Authentication"
  }
  if (type === AuthProviderType.OIDC) {
    return "OIDC (OpenID Connect)"
  }
  return type
}

export function AuthProviderSelector({
  authProviders,
  selectedProvider,
  onSelectProvider,
}: AuthProviderSelectorProps) {
  if (authProviders.length === 0) {
    return null
  }

  if (authProviders.length === 1) {
    return (
      <div className="space-y-2">
        <Label>Authentication Method</Label>
        <div className="text-sm text-muted-foreground">
          {getAuthProviderLabel(authProviders[0].type)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="authProvider">Authentication Method</Label>
      <Select
        value={selectedProvider?.type}
        onValueChange={(type) => {
          const provider = authProviders.find(p => p.type === type)
          if (provider) {
            onSelectProvider(provider)
          }
        }}
      >
        <SelectTrigger id="authProvider">
          <SelectValue placeholder="Select authentication method" />
        </SelectTrigger>
        <SelectContent>
          {authProviders.map((provider, index) => (
            <SelectItem key={`${provider.type}-${index}`} value={provider.type}>
              {getAuthProviderLabel(provider.type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

