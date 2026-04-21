import { cn, getInitials } from '../lib/utils'

const sizeMap = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
}

const colors = [
  'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-rose-500',
]

function colorFor(name) {
  let n = 0
  for (let i = 0; i < (name?.length ?? 0); i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

export default function Avatar({ name, avatarUrl, size = 'md', className }) {
  const sizeClass = sizeMap[size] || sizeMap.md
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', sizeClass, className)}
      />
    )
  }
  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0', sizeClass, colorFor(name), className)}>
      {getInitials(name)}
    </div>
  )
}
