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
import { catalogsApi } from "@/api/management/catalogs"
import { principalsApi } from "@/api/management/principals"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles } from "lucide-react"

export function Home() {
  const { data: catalogs } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list(),
  })

  const { data: principals } = useQuery({
    queryKey: ["principals"],
    queryFn: () => principalsApi.list(),
  })

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Get started with Apache Polaris</h1>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Easily manage and secure Iceberg tables and catalogs with the{" "}
            <span className="text-primary">Apache Polaris</span>.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Apache Polaris is an open source catalog for Apache Iceberg. Built on the open standard
            Apache Iceberg REST catalog protocol, Apache Polaris allows multiple engines to read and
            write Iceberg tables while consistently managing security for all queries from all
            engines.
          </p>
          <div className="flex items-center justify-end">
            <Sparkles className="h-24 w-24 text-primary/20" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Catalogs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{catalogs?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Connections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{principals?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Principals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{principals?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
