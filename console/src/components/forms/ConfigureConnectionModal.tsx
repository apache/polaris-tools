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

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { principalsApi } from "@/api/management/principals"
import { principalRolesApi } from "@/api/management/principal-roles"
import { QUERY_ENGINES } from "@/lib/constants"

const configureConnectionSchema = z.object({
  queryEngine: z.string(),
  principalName: z.string().min(1, "Principal name is required"),
  createNewPrincipalRole: z.boolean(),
  principalRoleName: z.string().optional(),
  principalRole: z.string().optional(),
})

type ConfigureConnectionFormData = z.infer<typeof configureConnectionSchema>

interface ConfigureConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (credentials: { clientId: string; clientSecret: string }) => void
}

export function ConfigureConnectionModal({
  open,
  onOpenChange,
  onSuccess,
}: ConfigureConnectionModalProps) {
  const [createNewRole, setCreateNewRole] = useState(false)

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ConfigureConnectionFormData>({
    resolver: zodResolver(configureConnectionSchema),
    defaultValues: {
      createNewPrincipalRole: false,
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: {
      principalName: string
      principalRoleName?: string
      createRole: boolean
    }) => {
      // Create principal
      const principalResult = await principalsApi.create({
        principal: {
          name: data.principalName,
          properties: {
            serviceType: watch("queryEngine"),
          },
        },
        credentialRotationRequired: false,
      })

      // Create principal role if needed
      if (data.createRole && data.principalRoleName) {
        await principalRolesApi.create({
          name: data.principalRoleName,
          properties: {},
        })
      }

      return principalResult
    },
    onSuccess: (data) => {
      toast.success("Connection configured successfully")
      onSuccess({
        clientId: data.credentials.clientId,
        clientSecret: data.credentials.clientSecret,
      })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error("Failed to configure connection", {
        description: error.message || "An error occurred",
      })
    },
  })

  const onSubmit = (formData: ConfigureConnectionFormData) => {
    createMutation.mutate({
      principalName: formData.principalName,
      principalRoleName: formData.createNewPrincipalRole
        ? formData.principalRoleName
        : undefined,
      createRole: formData.createNewPrincipalRole,
    })
  }

  const queryEngine = watch("queryEngine")

  // Auto-generate principal name based on query engine
  React.useEffect(() => {
    if (queryEngine && !watch("principalName")) {
      const engineName = queryEngine.replace("apache-", "").replace("-", "_")
      setValue("principalName", `polaris_demo_connection_${engineName}`)
    }
  }, [queryEngine, setValue, watch])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Service Connection</DialogTitle>
          <DialogDescription>
            Create a new service principal for connecting query engines
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="queryEngine">Query Engine</Label>
            <Select
              onValueChange={(value) => {
                setValue("queryEngine", value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select query engine" />
              </SelectTrigger>
              <SelectContent>
                {QUERY_ENGINES.map((engine) => (
                  <SelectItem key={engine.value} value={engine.value}>
                    {engine.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.queryEngine && (
              <p className="text-sm text-red-600">{errors.queryEngine.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="principalName">Principal Name</Label>
            <Input
              id="principalName"
              {...register("principalName")}
              placeholder="polaris_demo_connection_spark"
            />
            <p className="text-xs text-gray-500">
              A new principal will be created.
            </p>
            {errors.principalName && (
              <p className="text-sm text-red-600">
                {errors.principalName.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="createRole">Create new principal role</Label>
            <Switch
              id="createRole"
              checked={createNewRole}
              onCheckedChange={(checked) => {
                setCreateNewRole(checked)
                setValue("createNewPrincipalRole", checked)
              }}
            />
          </div>

          {createNewRole ? (
            <div className="space-y-2">
              <Label htmlFor="principalRoleName">Principal Role Name</Label>
              <Input
                id="principalRoleName"
                {...register("principalRoleName")}
                placeholder="Enter role name"
              />
              {errors.principalRoleName && (
                <p className="text-sm text-red-600">
                  {errors.principalRoleName.message}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="principalRole">Principal Role</Label>
              <Select
                onValueChange={(value) => {
                  setValue("principalRole", value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select principal role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CATALOG_MANAGERS">CATALOG_MANAGERS</SelectItem>
                  <SelectItem value="DATA_ENGINEERS">DATA_ENGINEERS</SelectItem>
                  <SelectItem value="DATA_SCIENTISTS">DATA_SCIENTISTS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending
                ? "Creating..."
                : "Create and generate credentials"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

