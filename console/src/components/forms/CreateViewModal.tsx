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

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { viewsApi } from "@/api/catalog/views"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CreateViewRequest } from "@/types/api"

const schema = z.object({
  name: z
    .string()
    .min(1, "View name is required")
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_]*$/,
      "View name must start with a letter or underscore and contain only alphanumeric characters and underscores"
    ),
  sql: z.string().min(1, "SQL query is required"),
  dialect: z.string().min(1, "SQL dialect is required"),
})

type FormValues = z.infer<typeof schema>

interface CreateViewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogName: string
  namespace: string[]
  onCreated?: () => void
}

export function CreateViewModal({
  open,
  onOpenChange,
  catalogName,
  namespace,
  onCreated,
}: CreateViewModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sql: "",
      dialect: "spark",
    },
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const request: CreateViewRequest = {
        name: values.name,
        schema: {
          type: "struct",
          fields: [],
        },
        "view-version": {
          "version-id": 1,
          "timestamp-ms": Date.now(),
          "schema-id": 0,
          summary: {
            "engine-name": values.dialect,
            "engine-version": "1.0.0",
          },
          representations: [
            {
              type: "sql",
              sql: values.sql,
              dialect: values.dialect,
            },
          ],
          "default-namespace": namespace,
        },
        properties: {},
      }
      return viewsApi.create(catalogName, namespace, request)
    },
    onSuccess: () => {
      toast.success("Iceberg view created successfully")
      onOpenChange(false)
      reset()
      onCreated?.()
    },
    onError: (error: Error) => {
      toast.error("Failed to create Iceberg view", {
        description: error.message || "An error occurred",
      })
    },
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Iceberg View</DialogTitle>
          <DialogDescription>
            Create a new Iceberg view in the namespace "{namespace.join(".")}".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">View Name</Label>
            <Input
              id="name"
              placeholder="my_view"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dialect">SQL Dialect</Label>
            <Input
              id="dialect"
              placeholder="spark"
              {...register("dialect")}
            />
            {errors.dialect && (
              <p className="text-sm text-red-600">{errors.dialect.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The SQL dialect used for the view (e.g., spark, trino, presto)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sql">SQL Query</Label>
            <Textarea
              id="sql"
              placeholder="SELECT * FROM my_table WHERE ..."
              className="min-h-[150px] font-mono text-sm"
              {...register("sql")}
            />
            {errors.sql && (
              <p className="text-sm text-red-600">{errors.sql.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The SQL query that defines this view
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create View"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

