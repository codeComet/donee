'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { canAccessAdmin, isPM } from '@/lib/permissions'
import Avatar from '@/components/ui/Avatar'
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher'
import {
  LayoutDashboard,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FolderKanban,
  Circle,
} from 'lucide-react'

export default function Sidebar({ profile, projects, workspaces = [], currentWorkspaceId, workspaceMember }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const tasksLabel = isPM(profile, workspaceMember) ? 'All Tasks' : 'My Tasks'

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/tasks', label: tasksLabel, icon: ListTodo },
  ]

  function isActive(href, exact) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const sidebarContent = (
    <aside
      className={cn(
        'flex flex-col h-full bg-slate-900 transition-all duration-300 ease-in-out overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center px-4 h-16 border-b border-slate-800 flex-shrink-0', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 9l4 4L14 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {!collapsed && <span className="text-white font-bold text-lg tracking-tight">Donee</span>}
      </div>

      {/* Workspace switcher */}
      <div className="pt-3 px-0">
        <WorkspaceSwitcher
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspaceId}
          collapsed={collapsed}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 space-y-1 px-2 overflow-y-auto scrollbar-thin">
        {/* Main links */}
        {navLinks.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
              isActive(href, exact)
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && label}
          </Link>
        ))}

        {/* Projects section */}
        {!collapsed && projects.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Projects
            </p>
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/project/${p.id}`}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  pathname === `/dashboard/project/${p.id}`
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <Circle
                  className="h-2.5 w-2.5 flex-shrink-0 fill-current"
                  style={{ color: p.color ?? '#6366f1' }}
                />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Admin link */}
        {canAccessAdmin(profile, workspaceMember) && (
          <Link
            href="/admin"
            title={collapsed ? 'Admin' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2',
              pathname.startsWith('/admin')
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            {!collapsed && 'Admin'}
          </Link>
        )}
      </nav>

      {/* User info at bottom */}
      <div className={cn('border-t border-slate-800 p-3 flex-shrink-0', collapsed ? 'flex justify-center' : 'flex items-center gap-3')}>
        <Avatar user={profile} size="sm" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-200 truncate">{profile?.full_name ?? 'User'}</p>
            <p className="text-xs text-slate-500 capitalize">
              {workspaceMember?.role?.replace('_', ' ') ?? profile?.role?.replace('_', ' ') ?? 'developer'}
            </p>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-slate-300 shadow-md transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="relative hidden md:flex flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile hamburger */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg"
        >
          <FolderKanban className="h-5 w-5" />
        </button>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-50 flex flex-col w-64 h-full bg-slate-900">
              {sidebarContent}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
