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

/**
 * Navigation utility for programmatic navigation
 * Can be used outside React components
 */

let navigateFunction: ((path: string) => void) | null = null

/**
 * Sets the navigation function (should be called from App.tsx or Layout)
 */
export function setNavigateFunction(fn: (path: string) => void) {
  navigateFunction = fn
}

/**
 * Navigates to a path programmatically
 * Falls back to window.location if navigate function is not set
 * 
 * @param path - The path to navigate to
 * @param replace - Whether to replace current history entry (default: false)
 */
export function navigate(path: string, replace: boolean = false) {
  if (navigateFunction) {
    navigateFunction(path)
  } else {
    // Fallback for use outside React context
    if (replace) {
      window.location.replace(path)
    } else {
      window.location.href = path
    }
  }
}

