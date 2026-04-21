import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs) => twMerge(clsx(inputs))

export const getInitials = name => {
  if (!name) return '?'
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const truncate = (str, n = 60) => {
  if (!str || str.length <= n) return str
  return str.slice(0, n) + '…'
}

export const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'estimation', label: 'Estimation' },
  { value: 'review', label: 'Review' },
  { value: 'done_in_staging', label: 'Done in Staging' },
  { value: 'waiting_for_confirmation', label: 'Waiting Confirm.' },
  { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Done' },
]

export const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' },
]

export const isTokenExpired = expiresAt => {
  if (!expiresAt) return true
  return Date.now() / 1000 >= expiresAt - 60
}
