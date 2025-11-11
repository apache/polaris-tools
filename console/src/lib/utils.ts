import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Decodes a JWT token and returns the payload
 * @param token - The JWT token string
 * @returns The decoded payload or null if invalid
 */
export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) {
      return null
    }
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(decoded)
  } catch (error) {
    console.error("Failed to decode JWT:", error)
    return null
  }
}

/**
 * Extracts the principal name from a JWT token
 * The principal name is typically in the 'sub' (subject) claim
 * @param token - The JWT token string
 * @returns The principal name or null if not found
 */
export function getPrincipalNameFromToken(token: string): string | null {
  const decoded = decodeJWT(token)
  if (!decoded) {
    return null
  }
  // Try common JWT claim names for the principal/subject
  return (
    (decoded.sub as string) ||
    (decoded.principal as string) ||
    (decoded.principal_name as string) ||
    (decoded.name as string) ||
    null
  )
}

