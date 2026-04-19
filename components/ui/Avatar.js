'use client'

import { useState } from 'react'
import { cn, getInitials } from '@/lib/utils'
import Image from 'next/image'

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
}

// Stable color from string hash
function colorFromName(name = '') {
  const colors = [
    'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-purple-500',
    'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-sky-500',
    'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-green-500',
    'bg-lime-500', 'bg-yellow-500', 'bg-amber-500', 'bg-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function Avatar({ user, size = 'md', className }) {
  const [imgError, setImgError] = useState(false)
  const initials = getInitials(user?.full_name ?? user?.email ?? '?')
  const bgColor = colorFromName(user?.full_name ?? user?.id ?? '')
  const sizeClass = sizeMap[size] ?? sizeMap.md

  if (user?.avatar_url && !imgError) {
    return (
      <div className={cn('rounded-full overflow-hidden flex-shrink-0 ring-1 ring-black/5', sizeClass, className)}>
        <Image
          src={user.avatar_url}
          alt={user.full_name ?? 'Avatar'}
          width={44}
          height={44}
          className="w-full h-full object-cover"
          unoptimized
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0',
        bgColor,
        sizeClass,
        className
      )}
      title={user?.full_name}
    >
      {initials}
    </div>
  )
}
