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

import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Users as UsersIcon } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PrincipalsTab } from "@/components/users/PrincipalsTab"
import { PrincipalRolesTab } from "@/components/users/PrincipalRolesTab"
import { CatalogRolesTab } from "@/components/users/CatalogRolesTab"
import { PrivilegesTab } from "@/components/users/PrivilegesTab"

export function AccessControl() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "principals"

  useEffect(() => {
    // Update document title based on active tab
    const tabTitles: Record<string, string> = {
      principals: "Principals",
      "principal-roles": "Principal Roles",
      "catalog-roles": "Catalog Roles",
      privileges: "Privileges",
    }
    document.title = `${tabTitles[activeTab] || "Users"} - Polaris`
  }, [activeTab])

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value })
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Users & Access Control</h1>
        </div>
        <p className="text-muted-foreground">
          Manage principals, roles, and privileges
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex justify-center">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="principals">Principals</TabsTrigger>
            <TabsTrigger value="principal-roles">Principal Roles</TabsTrigger>
            <TabsTrigger value="catalog-roles">Catalog Roles</TabsTrigger>
            <TabsTrigger value="privileges">Privileges</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="principals" className="mt-6">
          <PrincipalsTab />
        </TabsContent>

        <TabsContent value="principal-roles" className="mt-6">
          <PrincipalRolesTab />
        </TabsContent>

        <TabsContent value="catalog-roles" className="mt-6">
          <CatalogRolesTab />
        </TabsContent>

        <TabsContent value="privileges" className="mt-6">
          <PrivilegesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

