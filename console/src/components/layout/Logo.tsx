import { Link } from "react-router-dom"

interface LogoProps {
  variant?: "default" | "compact"
  showText?: boolean
  className?: string
  clickable?: boolean
}

export function Logo({ variant = "default", showText = true, className = "", clickable = true }: LogoProps) {
  const isCompact = variant === "compact"

  const logoContent = (
    <>
      {/* Logo Icon - Star logo */}
      <img
        src="/polaris-logo-star.svg"
        alt="Apache Polaris Logo"
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
      <Link
        to="/"
        className={`flex items-center gap-2 ${className}`}
        aria-label="Apache Polaris"
      >
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

