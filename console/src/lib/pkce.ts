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

const PKCE_VERIFIER_KEY = "pkce_code_verifier"
const PKCE_STATE_KEY = "pkce_state"

function generateRandomString(length: number): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  return Array.from(randomValues)
    .map((value) => charset[value % charset.length])
    .join("")
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest("SHA-256", data)
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(128)
  const hashed = await sha256(verifier)
  const challenge = base64UrlEncode(hashed)
  return { verifier, challenge }
}

export function generateState(): string {
  return generateRandomString(32)
}

export function storePKCEVerifier(verifier: string): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
}

export function getPKCEVerifier(): string | null {
  return sessionStorage.getItem(PKCE_VERIFIER_KEY)
}

export function clearPKCEVerifier(): void {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
}

export function storeState(state: string): void {
  sessionStorage.setItem(PKCE_STATE_KEY, state)
}

export function getState(): string | null {
  return sessionStorage.getItem(PKCE_STATE_KEY)
}

export function clearState(): void {
  sessionStorage.removeItem(PKCE_STATE_KEY)
}

export function clearPKCESession(): void {
  clearPKCEVerifier()
  clearState()
}
