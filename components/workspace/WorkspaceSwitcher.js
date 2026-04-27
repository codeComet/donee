'use client'

import { useTransition } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { switchWorkspace } from '@/app/workspace/actions'
import { Building2, Check, ChevronDown, Plus, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const ROLE_LABELS = { super_admin: 'Admin', pm: 'PM', developer: 'Member' }

export default function WorkspaceSwitcher({ workspaces, currentWorkspaceId, collapsed }) {
  const [isPending, startTransition] = useTransition()
  const current = workspaces.find((w) => w.id === currentWorkspaceId)

  function handleSwitch(id) {
    if (id === currentWorkspaceId) return
    startTransition(async () => {
      await switchWorkspace(id)
    })
  }

  if (collapsed) {
    return (
      <div className="px-2 mb-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="w-full flex items-center justify-center p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 transition-colors outline-none"
              title={current?.name ?? 'Workspace'}
            >
              <Building2 className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <WorkspacesMenu
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
              onSwitch={handleSwitch}
              isPending={isPending}
              side="right"
            />
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    )
  }

  return (
    <div className="px-2 mb-3">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 transition-colors outline-none group">
            <Building2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-indigo-100 truncate">{current?.name ?? 'Workspace'}</p>
              {current?.role && (
                <p className="text-xs text-indigo-400">{ROLE_LABELS[current.role] ?? current.role}</p>
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <WorkspacesMenu
            workspaces={workspaces}
            currentWorkspaceId={currentWorkspaceId}
            onSwitch={handleSwitch}
            isPending={isPending}
            side="bottom"
          />
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}

function WorkspacesMenu({ workspaces, currentWorkspaceId, onSwitch, isPending, side }) {
  return (
    <DropdownMenu.Content
      side={side}
      align="start"
      sideOffset={6}
      className="min-w-[220px] bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in"
    >
      <div className="px-3 py-1.5 mb-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Workspaces</p>
      </div>

      {workspaces.map((ws) => {
        const isActive = ws.id === currentWorkspaceId
        return (
          <DropdownMenu.Item
            key={ws.id}
            onSelect={() => onSwitch(ws.id)}
            disabled={isPending || isActive}
            className={cn(
              'flex items-center gap-3 px-3 py-2 text-sm cursor-pointer outline-none transition-colors',
              isActive
                ? 'text-indigo-300 bg-indigo-600/20'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            )}
          >
            <div className="w-6 h-6 bg-indigo-600/30 rounded flex items-center justify-center flex-shrink-0">
              <Building2 className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <span className="flex-1 truncate">{ws.name}</span>
            {isActive && <Check className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />}
          </DropdownMenu.Item>
        )
      })}

      <DropdownMenu.Separator className="my-1 border-t border-slate-700" />

      <DropdownMenu.Item asChild>
        <Link
          href="/workspace?view=create"
          className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer outline-none transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create workspace
        </Link>
      </DropdownMenu.Item>

      <DropdownMenu.Item asChild>
        <Link
          href="/workspace?view=join"
          className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer outline-none transition-colors"
        >
          <KeyRound className="h-4 w-4" />
          Join workspace
        </Link>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  )
}
