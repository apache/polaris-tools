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

import { Link, useLocation } from "react-router-dom"
import { Home, Link as LinkIcon, Database, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/constants"
import { Logo } from "@/components/layout/Logo"

const iconMap = {
  Home,
  Link: LinkIcon,
  Database,
  Shield,
}

export function Sidebar() {
  const location = useLocation()

  return (
    <div className="flex h-screen w-64 flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center px-5 border-b border-slate-800">
        <Logo clickable={false} inverted />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3 pt-4">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap]
          const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path))

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <Icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0",
                  isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300"
                )}
                style={{ width: "1.125rem", height: "1.125rem" }}
              />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4">
        <p className="text-[11px] text-slate-600 text-center">Apache Polaris™</p>
      </div>
    </div>
  )
}
