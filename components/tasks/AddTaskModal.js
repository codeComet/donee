'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'

const PRIORITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' },
]

const STATUSES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'estimation', label: 'Estimation' },
  { value: 'review', label: 'Review' },
  { value: 'done_in_staging', label: 'Done in Staging' },
  { value: 'waiting_for_confirmation', label: 'Waiting Confirm.' },
  { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Done' },
]

const INITIAL_FORM = {
  title: '',
  project_id: '',
  priority: 'medium',
  status: 'backlog',
  assigned_to: '',
  estimation: '',
  url: '',
  description: '',
}

export default function AddTaskModal({
  isOpen,
  onClose,
  projects,
  users,
  profile,
  defaultProjectId,
}) {
  const isDeveloper = profile?.role === 'developer'
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    project_id: defaultProjectId ?? '',
    // Developers are always assigned to themselves
    assigned_to: isDeveloper ? (profile?.id ?? '') : '',
  })
  const [errors, setErrors] = useState({})
  const qc = useQueryClient()

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validateStep1() {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.project_id) errs.project_id = 'Project is required'
    return errs
  }

  function handleNext() {
    const errs = validateStep1()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setStep(2)
  }

  const createTask = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const payload = {
        title: form.title.trim(),
        project_id: form.project_id,
        priority: form.priority || null,
        status: form.status || 'backlog',
        assigned_to: form.assigned_to || null,
        estimation: form.estimation || null,
        url: form.url || null,
        description: form.description || null,
        created_by: profile.id,
      }
      const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select(
          `*,
           project:projects(id, name, color),
           assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url),
           creator:profiles!tasks_created_by_fkey(id, full_name)`
        )
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (newTask) => {
      qc.setQueriesData({ queryKey: ['tasks'] }, (old) =>
        Array.isArray(old) ? [newTask, ...old.filter((t) => t.id !== newTask.id)] : [newTask]
      )
      qc.setQueriesData({ queryKey: ['tasks', 'project', newTask.project_id] }, (old) =>
        Array.isArray(old) ? [newTask, ...old.filter((t) => t.id !== newTask.id)] : [newTask]
      )
      qc.invalidateQueries({ queryKey: ['tasks'] })
      handleClose()
    },
  })

  function handleClose() {
    setStep(1)
    setForm({
      ...INITIAL_FORM,
      project_id: defaultProjectId ?? '',
      assigned_to: isDeveloper ? (profile?.id ?? '') : '',
    })
    setErrors({})
    onClose()
  }

  const inputClass = 'w-full text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-colors'
  const labelClass = 'block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5'
  const errorClass = 'text-xs text-red-500 mt-1'

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-fade-in overflow-hidden"
          aria-describedby="add-task-desc"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <div>
              <Dialog.Title className="text-base font-bold text-slate-900 dark:text-slate-100">Add Task</Dialog.Title>
              <p id="add-task-desc" className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Step {step} of 2 — {step === 1 ? 'Basic info' : 'Optional details'}
              </p>
            </div>
            {/* Step indicators */}
            <div className="flex items-center gap-1.5 mr-4">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    s === step ? 'bg-indigo-600' : s < step ? 'bg-indigo-300' : 'bg-slate-200 dark:bg-slate-600'
                  )}
                />
              ))}
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-5">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="What needs to be done?"
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                    className={cn(inputClass, errors.title && 'border-red-300 focus:border-red-400 focus:ring-red-500/20')}
                    autoFocus
                  />
                  {errors.title && <p className={errorClass}>{errors.title}</p>}
                </div>

                {!defaultProjectId && (
                  <div>
                    <label className={labelClass}>
                      Project <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.project_id}
                      onChange={(e) => update('project_id', e.target.value)}
                      className={cn(inputClass, errors.project_id && 'border-red-300')}
                    >
                      <option value="">Select a project…</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {errors.project_id && <p className={errorClass}>{errors.project_id}</p>}
                  </div>
                )}

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    placeholder="Optional description…"
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    rows={3}
                    className={cn(inputClass, 'resize-none')}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => update('priority', e.target.value)}
                      className={inputClass}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => update('status', e.target.value)}
                      className={inputClass}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Assigned To</label>
                  {isDeveloper ? (
                    <select value={profile?.id ?? ''} disabled className={cn(inputClass, 'opacity-70 cursor-not-allowed')}>
                      <option value={profile?.id ?? ''}>Assign to me</option>
                    </select>
                  ) : (
                    <select
                      value={form.assigned_to}
                      onChange={(e) => update('assigned_to', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Estimation</label>
                  <input
                    type="text"
                    placeholder="e.g. 3-4hrs, 30mins, 2 days"
                    value={form.estimation}
                    onChange={(e) => update('estimation', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>URL</label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={form.url}
                    onChange={(e) => update('url', e.target.value)}
                    className={inputClass}
                  />
                </div>

                {createTask.error && (
                  <p className="text-sm text-red-500">{createTask.error.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
            {step === 2 ? (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                Cancel
              </button>
              {step === 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => createTask.mutate()}
                  disabled={createTask.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {createTask.isPending ? 'Creating…' : 'Create Task'}
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
