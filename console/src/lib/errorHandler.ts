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

import axios from "axios"
import type { AxiosError } from "axios"

/**
 * Extracts a user-friendly error message from an error object
 * Handles various error formats from the API
 * 
 * @param error - The error object (can be unknown, AxiosError, Error, etc.)
 * @param defaultMessage - Default message to return if error cannot be parsed
 * @returns A user-friendly error message string
 */
export function extractErrorMessage(error: unknown, defaultMessage: string): string {
  // Handle Axios errors
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>
    
    // Check for error message in response data first
    if (axiosError.response?.data) {
      const data = axiosError.response.data as Record<string, unknown>
      
      // Try nested error.message first (e.g., { error: { message: "..." } })
      if (data && typeof data === 'object' && 'error' in data) {
        const errorObj = data.error as Record<string, unknown>
        if (errorObj && typeof errorObj === 'object' && 'message' in errorObj && typeof errorObj.message === 'string') {
          return errorObj.message
        }
      }
      
      // Try top-level message (e.g., { message: "..." })
      if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
        return data.message
      }
    }
    
    // Use Axios error message if available
    if (axiosError.message) {
      return axiosError.message
    }
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message
  }
  
  // Fallback to default message
  return defaultMessage
}

/**
 * Gets a user-friendly error message based on HTTP status code
 * 
 * @param status - HTTP status code
 * @param resource - The resource being accessed (e.g., "catalog", "privilege")
 * @param action - The action being performed (e.g., "create", "delete")
 * @returns A user-friendly error message
 */
export function getStatusErrorMessage(
  status: number,
  resource: string = "resource",
  action: string = "perform this action"
): string {
  switch (status) {
    case 400:
      return `Invalid request. Please check your input and try again.`
    case 401:
      return "You are not authenticated. Please log in again."
    case 403:
      return `You don't have permission to ${action} on this ${resource}.`
    case 404:
      return `The ${resource} was not found.`
    case 409:
      return "Entity version mismatch. The resource may have been modified. Please refresh and try again."
    case 422:
      return "The request is valid but cannot be processed. Please check your input."
    case 500:
      return "An internal server error occurred. Please try again later."
    case 503:
      return "The service is temporarily unavailable. Please try again later."
    default:
      return `An error occurred while trying to ${action} the ${resource}.`
  }
}

/**
 * Extracts error message with status code handling
 * Combines extractErrorMessage and getStatusErrorMessage
 * 
 * @param error - The error object
 * @param defaultMessage - Default message to return
 * @param resource - The resource being accessed (optional)
 * @param action - The action being performed (optional)
 * @returns A user-friendly error message
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage: string,
  resource?: string,
  action?: string
): string {
  // First, try to extract message from HTTP response (prioritizes response data over axios error message)
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>
    
    // Check for error message in HTTP response data first
    if (axiosError.response?.data) {
      const data = axiosError.response.data as Record<string, unknown>
      
      // Try nested error.message first (e.g., { error: { message: "..." } })
      if (data && typeof data === 'object' && 'error' in data) {
        const errorObj = data.error as Record<string, unknown>
        if (errorObj && typeof errorObj === 'object' && 'message' in errorObj && typeof errorObj.message === 'string') {
          return errorObj.message
        }
      }
      
      // Try top-level message (e.g., { message: "..." })
      if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
        return data.message
      }
    }
    
    // If no message in response data, fallback to axios error message
    if (axiosError.message) {
      return axiosError.message
    }
    
    // If we have a status code but no specific message, use status-based message
    if (axiosError.response?.status) {
      return getStatusErrorMessage(
        axiosError.response.status,
        resource,
        action
      )
    }
  }
  
  // Fall back to extracting message (handles non-Axios errors)
  return extractErrorMessage(error, defaultMessage)
}

/**
 * Type guard to check if error is an Axios error with response
 */
export function isAxiosErrorWithResponse(error: unknown): error is AxiosError {
  return axios.isAxiosError(error) && error.response !== undefined
}

