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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Link as LinkIcon, Plus, RefreshCw, Search, MoreVertical } from "lucide-react"
import { principalsApi } from "@/api/management/principals"
import { getErrorMessage } from "@/lib/errorHandler"
import type { Principal } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfigureConnectionModal } from "@/components/forms/ConfigureConnectionModal"
import { CredentialsModal } from "@/components/forms/CredentialsModal"
import { PrincipalDetailsModal } from "@/components/users/PrincipalDetailsModal"
import { EditPrincipalModal } from "@/components/forms/EditPrincipalModal"
import { ResetCredentialsModal } from "@/components/forms/ResetCredentialsModal"

export function Connections() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isConfigureModalOpen, setIsConfigureModalOpen] = useState(false)
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)
  const [connectionToReset, setConnectionToReset] = useState<string | null>(null)
  const [principalToView, setPrincipalToView] = useState<Principal | null>(null)
  const [principalToEdit, setPrincipalToEdit] = useState<Principal | null>(null)
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    clientId: string
    clientSecret: string
  } | null>(null)

  const queryClient = useQueryClient()

  const { data: principals = [], isLoading } = useQuery({
    queryKey: ["principals"],
    queryFn: () => principalsApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (principalName: string) => principalsApi.delete(principalName),
    onSuccess: () => {
      toast.success("Connection deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["principals"] })
      setConnectionToDelete(null)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to delete connection",
        "connection",
        "delete"
      )
      toast.error("Failed to delete connection", {
        description: errorMsg,
      })
    },
  })

  const rotateMutation = useMutation({
    mutationFn: (principalName: string) =>
      principalsApi.rotateCredentials(principalName),
    onSuccess: (data) => {
      toast.success("Credentials rotated successfully")
      setGeneratedCredentials({
        clientId: data.credentials.clientId,
        clientSecret: data.credentials.clientSecret,
      })
      setIsCredentialsModalOpen(true)
      queryClient.invalidateQueries({ queryKey: ["principals"] })
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to rotate credentials",
        "credentials",
        "rotate"
      )
      toast.error("Failed to rotate credentials", {
        description: errorMsg,
      })
    },
  })

  const handleResetSuccess = (credentials: { clientId: string; clientSecret: string }) => {
    setGeneratedCredentials(credentials)
    setIsCredentialsModalOpen(true)
    queryClient.invalidateQueries({ queryKey: ["principals"] })
    setConnectionToReset(null)
  }

  const filteredPrincipals = principals.filter((principal) =>
    principal.name.toLowerCase().includes(searchQuery.toLowerCase())
  )


  const handleCreateSuccess = (credentials: { clientId: string; clientSecret: string }) => {
    setGeneratedCredentials(credentials)
    setIsConfigureModalOpen(false)
    setIsCredentialsModalOpen(true)
    queryClient.invalidateQueries({ queryKey: ["principals"] })
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LinkIcon className="h-6 w-6 text-foreground" />
            <h1 className="text-3xl font-bold text-foreground">Service Connections</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Q Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48"
              />
              <Button variant="ghost" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["principals"] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setIsConfigureModalOpen(true)}
              variant="default"
            >
              <Plus className="mr-2 h-4 w-4" />
              Connection
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PRINCIPAL NAME</TableHead>
              <TableHead>SERVICE</TableHead>
              <TableHead>CREATED</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPrincipals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No connections found
                </TableCell>
              </TableRow>
            ) : (
              filteredPrincipals.map((principal) => {
                // Cast to include timestamp fields that may be present in API response
                const principalWithTimestamps = principal as Principal & {
                  createTimestamp?: number
                  lastUpdateTimestamp?: number
                }
                // Try createTimestamp first, then lastUpdateTimestamp as fallback
                const timestamp =
                  principalWithTimestamps.createTimestamp ||
                  principalWithTimestamps.lastUpdateTimestamp ||
                  (typeof principalWithTimestamps.properties?.createTimestamp === "string"
                    ? parseInt(principalWithTimestamps.properties.createTimestamp, 10)
                    : typeof principalWithTimestamps.properties?.createTimestamp === "number"
                    ? principalWithTimestamps.properties.createTimestamp
                    : typeof principalWithTimestamps.properties?.lastUpdateTimestamp === "string"
                    ? parseInt(principalWithTimestamps.properties.lastUpdateTimestamp, 10)
                    : typeof principalWithTimestamps.properties?.lastUpdateTimestamp === "number"
                    ? principalWithTimestamps.properties.lastUpdateTimestamp
                    : undefined)

                return (
                  <TableRow key={principal.name}>
                    <TableCell className="font-medium">{principal.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {principal.properties?.serviceType || "apache-spark"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {timestamp
                        ? formatDistanceToNow(new Date(timestamp), {
                            addSuffix: true,
                          })
                        : "Unknown"}
                    </TableCell>
                    <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setPrincipalToView(principal)
                          }}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setPrincipalToEdit(principal)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            rotateMutation.mutate(principal.name)
                          }}
                        >
                          Rotate Credentials
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setConnectionToReset(principal.name)
                          }}
                        >
                          Reset Credentials
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setConnectionToDelete(principal.name)
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      <ConfigureConnectionModal
        open={isConfigureModalOpen}
        onOpenChange={setIsConfigureModalOpen}
        onSuccess={handleCreateSuccess}
      />
      <CredentialsModal
        open={isCredentialsModalOpen}
        onOpenChange={setIsCredentialsModalOpen}
        credentials={generatedCredentials}
      />
      {principalToView && (
        <PrincipalDetailsModal
          open={!!principalToView}
          onOpenChange={(open) => !open && setPrincipalToView(null)}
          principal={principalToView}
        />
      )}
      {principalToEdit && (
        <EditPrincipalModal
          open={!!principalToEdit}
          onOpenChange={(open) => !open && setPrincipalToEdit(null)}
          principal={principalToEdit}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["principals"] })
            setPrincipalToEdit(null)
          }}
        />
      )}

      {/* Reset Credentials Modal */}
      {connectionToReset && (
        <ResetCredentialsModal
          open={!!connectionToReset}
          onOpenChange={(open) => !open && setConnectionToReset(null)}
          principalName={connectionToReset}
          onSuccess={handleResetSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!connectionToDelete}
        onOpenChange={(open) => !open && setConnectionToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Connection</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              connection <span className="font-medium">{connectionToDelete}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConnectionToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                connectionToDelete && deleteMutation.mutate(connectionToDelete)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
