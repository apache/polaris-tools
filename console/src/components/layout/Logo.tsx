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

import { Link } from "react-router-dom"

interface LogoProps {
  variant?: "default" | "compact"
  showText?: boolean
  className?: string
  clickable?: boolean
}

export function Logo({
  variant = "default",
  showText = true,
  className = "",
  clickable = true,
}: LogoProps) {
  const isCompact = variant === "compact"

  const logoContent = (
    <>
      {/* Logo Icon - Star logo */}
      <img
        src="/apache-polaris-logo.svg"
        alt="Logo"
        className={isCompact ? "h-6 w-6" : "h-8 w-8"}
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold text-foreground ${isCompact ? "text-sm" : "text-base"}`}>
            Apache Polaris
          </span>
        </div>
      )}
    </>
  )

  if (clickable) {
    return (
      <Link to="/" className={`flex items-center gap-2 ${className}`} aria-label="Apache Polaris">
        {logoContent}
      </Link>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} aria-label="Apache Polaris">
      {logoContent}
    </div>
  )
}
