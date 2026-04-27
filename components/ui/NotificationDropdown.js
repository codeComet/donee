'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Popover from '@radix-ui/react-popover'
import { Bell, CheckCheck } from 'lucide-react'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from '@/lib/notifications'
import { formatDistanceToNow } from 'date-fns'

export default function NotificationDropdown({ userId }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data = { unread: [], seen: [] } } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: fetchNotifications,
    enabled: !!userId,
    refetchInterval: 60_000,
  })

  const { unread, seen } = data

  useEffect(() => {
    if (!userId) return
    const unsub = subscribeToNotifications(userId, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    })
    return unsub
  }, [userId, queryClient])

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  })

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  })

  async function handleNotificationClick(n) {
    if (!n.is_read) await markRead.mutateAsync(n.id)
    setOpen(false)
    router.push(`/dashboard/tasks?task=${n.task_id}`)
  }

  const count = unread.length

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 outline-none">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="w-80 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 animate-fade-in overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Notifications {count > 0 && <span className="text-indigo-600">({count})</span>}
            </h3>
            {count > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {unread.length === 0 && seen.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">All caught up!</p>
              </div>
            ) : (
              <>
                {unread.length === 0 && (
                  <div className="py-4 text-center">
                    <p className="text-xs text-slate-400 dark:text-slate-500">No new notifications</p>
                  </div>
                )}
                {unread.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0"
                  >
                    <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </button>
                ))}

                {seen.length > 0 && (
                  <>
                    <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Earlier
                      </p>
                    </div>
                    {seen.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0 opacity-60"
                      >
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
