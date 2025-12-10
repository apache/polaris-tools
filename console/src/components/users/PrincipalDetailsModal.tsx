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

import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { principalsApi } from "@/api/management/principals"
import type { Principal } from "@/types/api"

// Extended Principal type that includes fields that may be present in API responses
type ExtendedPrincipal = Principal & {
  createTimestamp?: number
  clientId?: string
  clientSecret?: string
}

interface PrincipalDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  principal: Principal | null
}

export function PrincipalDetailsModal({
  open,
  onOpenChange,
  principal,
}: PrincipalDetailsModalProps) {
  const { data: principalDetails, isLoading } = useQuery({
    queryKey: ["principal", principal?.name],
    queryFn: () => principalsApi.get(principal!.name),
    enabled: open && !!principal?.name,
  })

  const displayPrincipal: ExtendedPrincipal | null = (principalDetails || principal) as ExtendedPrincipal

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Principal Details</DialogTitle>
          <DialogDescription>
            View detailed information about this principal.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-4 text-center text-muted-foreground">Loading...</div>
        ) : displayPrincipal ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="mt-1 font-medium">{displayPrincipal.name}</p>
            </div>

            {displayPrincipal.properties &&
              Object.keys(displayPrincipal.properties).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Properties
                  </label>
                  <div className="mt-2 rounded-md border p-3 bg-muted/50">
                    <div className="space-y-1">
                      {Object.entries(displayPrincipal.properties).map(
                        ([key, value]) => (
                          <div key={key} className="flex gap-2 text-sm">
                            <span className="font-medium">{key}:</span>
                            <span className="text-muted-foreground">{value}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

            {displayPrincipal.createTimestamp && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created
                </label>
                <p className="mt-1 text-sm">
                  {formatDistanceToNow(
                    new Date(displayPrincipal.createTimestamp),
                    { addSuffix: true }
                  )}
                </p>
              </div>
            )}

            {displayPrincipal.clientId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Client ID
                </label>
                <p className="mt-1 font-mono text-sm bg-muted/50 p-2 rounded">
                  {displayPrincipal.clientId}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

