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

