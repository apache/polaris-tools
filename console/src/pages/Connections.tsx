import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Link as LinkIcon, Plus, RefreshCw, Search, MoreVertical } from "lucide-react"
import { principalsApi } from "@/api/management/principals"
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

export function Connections() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isConfigureModalOpen, setIsConfigureModalOpen] = useState(false)
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)
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
    onError: (error: Error) => {
      toast.error("Failed to delete connection", {
        description: error.message || "An error occurred",
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
    onError: (error: Error) => {
      toast.error("Failed to rotate credentials", {
        description: error.message || "An error occurred",
      })
    },
  })

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
              className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
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
                        {principal.properties?.serviceType || "Apache Spark"}
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
                            // TODO: Implement view details
                          }}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            // TODO: Implement edit
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
                            // TODO: Implement reset
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
