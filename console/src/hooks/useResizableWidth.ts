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

import { useState, useEffect, useRef, useCallback } from "react"
import {
  CATALOG_EXPLORER_STORAGE_KEY,
  CATALOG_EXPLORER_MIN_WIDTH,
  CATALOG_EXPLORER_MAX_WIDTH,
  CATALOG_EXPLORER_DEFAULT_WIDTH,
} from "@/lib/constants"

/**
 * Custom hook for managing resizable width with localStorage persistence
 */
export function useResizableWidth() {
  const [width, setWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(CATALOG_EXPLORER_STORAGE_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        // Validate stored value is within bounds
        if (parsed >= CATALOG_EXPLORER_MIN_WIDTH && parsed <= CATALOG_EXPLORER_MAX_WIDTH) {
          return parsed
        }
      }
    }
    return CATALOG_EXPLORER_DEFAULT_WIDTH
  })

  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(0)

  // Save width to localStorage
  useEffect(() => {
    localStorage.setItem(CATALOG_EXPLORER_STORAGE_KEY, width.toString())
  }, [width])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startXRef.current = e.clientX
    startWidthRef.current = width
    setIsResizing(true)
  }, [width])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current
      const newWidth = startWidthRef.current + diff
      
      // Clamp width within bounds
      const clampedWidth = Math.max(
        CATALOG_EXPLORER_MIN_WIDTH,
        Math.min(CATALOG_EXPLORER_MAX_WIDTH, newWidth)
      )
      setWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing])

  return {
    width,
    isResizing,
    handleMouseDown,
  }
}

