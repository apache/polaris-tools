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
import { useNavigate } from "react-router-dom"
import { catalogsApi } from "@/api/management/catalogs"
import { principalsApi } from "@/api/management/principals"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Database, Link2, Shield, ArrowRight, Layers, BookOpen } from "lucide-react"

export function Home() {
  const navigate = useNavigate()

  const { data: catalogs } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list(),
  })

  const { data: principals } = useQuery({
    queryKey: ["principals"],
    queryFn: () => principalsApi.list(),
  })

  const stats = [
    {
      label: "Catalogs",
      value: catalogs?.length ?? 0,
      icon: Database,
      color: "text-teal-600",
      bg: "bg-teal-50",
      href: "/catalogs",
    },
    {
      label: "Connections",
      value: catalogs?.length ?? 0,
      icon: Link2,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/connections",
    },
    {
      label: "Principals",
      value: principals?.length ?? 0,
      icon: Shield,
      color: "text-violet-600",
      bg: "bg-violet-50",
      href: "/access-control",
    },
  ]

  const quickLinks = [
    {
      title: "Browse Catalogs",
      description: "Explore your Iceberg catalogs, namespaces, tables, and views.",
      icon: Database,
      href: "/catalogs",
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      title: "Manage Access",
      description: "Configure principals, roles and fine-grained privileges.",
      icon: Shield,
      href: "/access-control",
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: "Connections",
      description: "Set up and manage external catalog connections.",
      icon: Link2,
      href: "/connections",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ]

  return (
    <div className="min-h-full p-8 space-y-8 max-w-5xl">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-8 text-white shadow-lg">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 opacity-80" />
              <span className="text-sm font-medium opacity-80">Apache Iceberg REST Catalog</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight">
              Welcome to Apache Polaris
            </h1>
            <p className="max-w-lg text-sm leading-relaxed opacity-80">
              Open-source catalog for Apache Iceberg. Manage and secure your tables across all
              query engines with a single, consistent REST catalog protocol.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => navigate("/catalogs")}
                className="bg-white text-primary hover:bg-white/90 shadow-none font-semibold"
                size="sm"
              >
                Browse Catalogs
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <a
                href="https://polaris.apache.org/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Documentation
              </a>
            </div>
          </div>
          <Layers className="h-28 w-28 opacity-10 shrink-0 hidden lg:block" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.label}
              className="cursor-pointer transition-shadow hover:shadow-card-hover"
              onClick={() => navigate(stat.href)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Quick actions</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Card
                key={link.title}
                className="cursor-pointer transition-shadow hover:shadow-card-hover group"
                onClick={() => navigate(link.href)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className={`inline-flex rounded-lg p-2.5 ${link.bg}`}>
                    <Icon className={`h-4.5 w-4.5 ${link.color}`} style={{ width: "1.125rem", height: "1.125rem" }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {link.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {link.description}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
