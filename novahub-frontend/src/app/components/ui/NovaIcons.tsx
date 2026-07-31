import React from 'react'

interface IconProps {
  className?: string
  size?: number
}

export function NovaSuiteIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="novaGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#novaGrad)" opacity="0.15" />
      <path d="M8 8h8M8 12h5M8 16h6" stroke="url(#novaGrad)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17.5" cy="17.5" r="2.5" fill="url(#novaGrad)" />
      <path d="M17.5 16v1.5l1 .8" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function NovaChatIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="chatGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2V6z" stroke="url(#chatGrad)" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="9" cy="10" r="1" fill="url(#chatGrad)" />
      <circle cx="13" cy="10" r="1" fill="url(#chatGrad)" />
      <circle cx="17" cy="10" r="1" fill="url(#chatGrad)" />
    </svg>
  )
}

export function NovaCustomersIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="9" cy="8" r="3.2" stroke="#f59e0b" strokeWidth="1.6" />
      <circle cx="17" cy="9" r="2.5" stroke="#3b82f6" strokeWidth="1.6" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.5 14.5c2.5 0 4.5 1.7 4.5 4" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function NovaSalesIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M4 17l5-5 3 3 6-7" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8h5v5" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="#059669" strokeWidth="1.2" opacity="0.4" />
    </svg>
  )
}

export function NovaInventoryIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M3 7l9-4 9 4-9 4-9-4z" stroke="#3b82f6" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 7v10l9 4 9-4V7" stroke="#3b82f6" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 11v10" stroke="#3b82f6" strokeWidth="1.6" />
    </svg>
  )
}

export function NovaReportsIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M4 20V4" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 20h16" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="7" y="12" width="3" height="6" rx="1" fill="#8b5cf6" opacity="0.7" />
      <rect x="12" y="8" width="3" height="10" rx="1" fill="#8b5cf6" opacity="0.85" />
      <rect x="17" y="5" width="3" height="13" rx="1" fill="#8b5cf6" />
    </svg>
  )
}

export function NovaFinanceIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="#059669" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="#059669" strokeWidth="1.6" />
      <circle cx="16.5" cy="14.5" r="2" fill="#059669" />
      <path d="M7 15h4" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
