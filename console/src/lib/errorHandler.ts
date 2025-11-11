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
    const axiosError = error as AxiosError<{ error?: { message?: string }; message?: string }>
    
    // Check for error message in response data
    if (axiosError.response?.data) {
      const data = axiosError.response.data
      
      // Try nested error.message first
      if (data.error?.message) {
        return data.error.message
      }
      
      // Try top-level message
      if (data.message) {
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
  // First try to get status-based message
  if (axios.isAxiosError(error) && error.response?.status) {
    const statusMessage = getStatusErrorMessage(
      error.response.status,
      resource,
      action
    )
    
    // If we have a more specific message from the response, use it
    const extractedMessage = extractErrorMessage(error, "")
    if (extractedMessage && extractedMessage !== error.message) {
      return extractedMessage
    }
    
    return statusMessage
  }
  
  // Fall back to extracting message
  return extractErrorMessage(error, defaultMessage)
}

/**
 * Type guard to check if error is an Axios error with response
 */
export function isAxiosErrorWithResponse(error: unknown): error is AxiosError {
  return axios.isAxiosError(error) && error.response !== undefined
}

