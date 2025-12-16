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

import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
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
import { Switch } from "@/components/ui/switch"
import { principalsApi } from "@/api/management/principals"
import { getErrorMessage } from "@/lib/errorHandler"
import type { PrincipalWithCredentials } from "@/types/api"

const resetCredentialsSchema = z
  .object({
    useCustomCredentials: z.boolean(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.useCustomCredentials) {
        return true // If not using custom credentials, validation passes
      }
      // If using custom credentials, both fields are required
      return (
        data.clientId !== undefined &&
        data.clientId.trim().length > 0 &&
        data.clientSecret !== undefined &&
        data.clientSecret.trim().length > 0
      )
    },
    {
      message: "Both Client ID and Client Secret are required when using custom credentials",
      path: ["clientSecret"],
    }
  )

type ResetCredentialsFormData = z.infer<typeof resetCredentialsSchema>

interface ResetCredentialsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  principalName: string
  onSuccess: (credentials: { clientId: string; clientSecret: string }) => void
}

export function ResetCredentialsModal({
  open,
  onOpenChange,
  principalName,
  onSuccess,
}: ResetCredentialsModalProps) {
  const form = useForm<ResetCredentialsFormData>({
    resolver: zodResolver(resetCredentialsSchema),
    defaultValues: {
      useCustomCredentials: false,
      clientId: "",
      clientSecret: "",
    },
  })

  const useCustomCredentials = form.watch("useCustomCredentials")

  const resetMutation = useMutation({
    mutationFn: async (data: ResetCredentialsFormData) => {
      if (data.useCustomCredentials && data.clientId && data.clientSecret) {
        return principalsApi.reset(principalName, data.clientId, data.clientSecret)
      } else {
        // Call without credentials to generate new ones
        return principalsApi.reset(principalName)
      }
    },
    onSuccess: (data: PrincipalWithCredentials) => {
      toast.success("Credentials reset successfully")
      onSuccess({
        clientId: data.credentials.clientId,
        clientSecret: data.credentials.clientSecret,
      })
      form.reset()
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(
        error,
        "Failed to reset credentials",
        "credentials",
        "reset"
      )
      toast.error("Failed to reset credentials", {
        description: errorMsg,
      })
    },
  })

  const onSubmit = (data: ResetCredentialsFormData) => {
    resetMutation.mutate(data)
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reset Credentials</DialogTitle>
          <DialogDescription>
            Reset credentials for <span className="font-medium">{principalName}</span>.
            You can provide custom credentials or let the system generate new ones.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="useCustomCredentials" className="text-base">
                Use Custom Credentials
              </Label>
              <p className="text-sm text-muted-foreground">
                {useCustomCredentials
                  ? "Provide your own Client ID and Client Secret"
                  : "System will generate new credentials automatically"}
              </p>
            </div>
            <Switch
              id="useCustomCredentials"
              checked={useCustomCredentials}
              onCheckedChange={(checked) => {
                form.setValue("useCustomCredentials", checked)
                if (!checked) {
                  form.setValue("clientId", "")
                  form.setValue("clientSecret", "")
                }
              }}
            />
          </div>

          {useCustomCredentials && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">
                  Client ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="clientId"
                  {...form.register("clientId")}
                  placeholder="Enter client ID"
                  disabled={resetMutation.isPending}
                />
                {form.formState.errors.clientId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.clientId.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Must be a valid client ID previously generated by this service.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">
                  Client Secret <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="clientSecret"
                  type="password"
                  {...form.register("clientSecret")}
                  placeholder="Enter client secret"
                  disabled={resetMutation.isPending}
                />
                {form.formState.errors.clientSecret && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.clientSecret.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Must meet the service's requirements for secret format.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={resetMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? "Resetting..." : "Reset Credentials"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

