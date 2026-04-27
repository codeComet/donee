'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/ui/Avatar'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const inputClass =
  'w-full text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400'
const labelClass =
  'block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5'
const readonlyClass =
  'text-sm text-slate-600 dark:text-slate-300 px-3 py-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600'

export default function ProfileModal({ isOpen, onClose, profile, workspaceMember }) {
  const router = useRouter()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')

  useEffect(() => {
    if (isOpen) setFullName(profile?.full_name ?? '')
  }, [isOpen, profile])

  const save = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', profile.id)
      if (error) throw error
    },
    onSuccess: () => {
      router.refresh()
      onClose()
    },
  })

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-fade-in"
          aria-describedby="profile-modal-desc"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <Dialog.Title className="text-base font-bold text-slate-900 dark:text-slate-100">
              Your Profile
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-5 space-y-4">
            <p id="profile-modal-desc" className="sr-only">Edit your profile details</p>

            <div className="flex justify-center pb-1">
              <Avatar user={profile} size="lg" />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <p className={readonlyClass}>{profile?.email ?? '—'}</p>
            </div>

            <div>
              <label className={labelClass}>Role</label>
              <p className={cn(readonlyClass, 'capitalize')}>
                {(workspaceMember?.role ?? profile?.role)?.replace('_', ' ') ?? '—'}
              </p>
            </div>

            <div>
              <label className={labelClass}>Display Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !save.isPending && fullName.trim() && save.mutate()}
                placeholder="Your name"
                className={inputClass}
                autoFocus
              />
            </div>

            {save.error && (
              <p className="text-sm text-red-500">{save.error.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !fullName.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
