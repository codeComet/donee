'use client'

import { cn } from '@/lib/utils'
import { Search, X, ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'

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

const PRIORITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' },
]

function MultiSelectFilter({ label, options, selected, onChange }) {
  const hasSelection = selected.length > 0

  function toggle(value) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    )
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors outline-none',
            hasSelection
              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
          )}
        >
          {label}
          {hasSelection && (
            <span className="bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="min-w-[160px] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1.5 z-50 animate-fade-in"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 transition-colors"
            >
              <div
                className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                  selected.includes(opt.value)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-slate-300 dark:border-slate-600'
                )}
              >
                {selected.includes(opt.value) && (
                  <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {opt.label}
            </button>
          ))}
          {selected.length > 0 && (
            <>
              <hr className="my-1 border-slate-100 dark:border-slate-700" />
              <button
                onClick={() => onChange([])}
                className="w-full px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors text-left"
              >
                Clear selection
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default function TaskFilters({ filters, onChange, projects, users, hideProjectFilter }) {
  const activeFilterCount = [
    filters.projectIds.length,
    filters.statuses.length,
    filters.priorities.length,
    filters.assigneeIds.length,
    filters.dateFrom ? 1 : 0,
    filters.dateTo ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  function update(key, value) {
    onChange({ ...filters, [key]: value })
  }

  function clearAll() {
    onChange({
      search: filters.search,
      projectIds: [],
      statuses: [],
      priorities: [],
      assigneeIds: [],
      dateFrom: '',
      dateTo: '',
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search tasks…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
        {filters.search && (
          <button
            onClick={() => update('search', '')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {!hideProjectFilter && projects.length > 0 && (
          <MultiSelectFilter
            label="Project"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            selected={filters.projectIds}
            onChange={(v) => update('projectIds', v)}
          />
        )}
        <MultiSelectFilter
          label="Status"
          options={STATUSES}
          selected={filters.statuses}
          onChange={(v) => update('statuses', v)}
        />
        <MultiSelectFilter
          label="Priority"
          options={PRIORITIES}
          selected={filters.priorities}
          onChange={(v) => update('priorities', v)}
        />
        <MultiSelectFilter
          label="Assignee"
          options={users.map((u) => ({ value: u.id, label: u.full_name }))}
          selected={filters.assigneeIds}
          onChange={(v) => update('assigneeIds', v)}
        />

        {/* Date range */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors outline-none',
                filters.dateFrom || filters.dateTo
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              Date
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className="w-56 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-3 z-50 animate-fade-in space-y-2"
            >
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => update('dateFrom', e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => update('dateTo', e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              {(filters.dateFrom || filters.dateTo) && (
                <button
                  onClick={() => { update('dateFrom', ''); update('dateTo', '') }}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  Clear dates
                </button>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear ({activeFilterCount})
          </button>
        )}
      </div>
    </div>
  )
}
