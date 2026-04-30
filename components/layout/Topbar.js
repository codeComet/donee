'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/components/providers/ThemeProvider'
import Avatar from '@/components/ui/Avatar'
import NotificationDropdown from '@/components/ui/NotificationDropdown'
import ProfileModal from '@/components/ui/ProfileModal'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronRight, LogOut, User, Sun, Moon } from 'lucide-react'

function getBreadcrumbs(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  const crumbs = [{ label: 'Home', href: '/dashboard' }]
  let path = ''
  for (const part of parts) {
    path += `/${part}`
    const label =
      part === 'dashboard' ? 'Dashboard'
      : part === 'tasks' ? 'All Tasks'
      : part === 'project' ? 'Projects'
      : part === 'admin' ? 'Admin'
      : part.length === 36 ? '…' // UUID segment
      : part.charAt(0).toUpperCase() + part.slice(1)
    crumbs.push({ label, href: path })
  }
  return crumbs.slice(1) // skip Home since we show it as root
}

export default function Topbar({ user, profile, workspace, workspaceMember }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const crumbs = getBreadcrumbs(pathname)
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 gap-4 flex-shrink-0 z-10">
      {/* Breadcrumb */}
      <nav className="flex-1 flex items-center gap-1 min-w-0 text-sm ml-10 md:ml-0">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />}
            {i === crumbs.length - 1 ? (
              <span className="text-slate-700 dark:text-slate-200 font-medium truncate">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors truncate"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationDropdown userId={user?.id} />

        {/* User dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none">
              <Avatar user={profile} size="sm" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block max-w-[120px] truncate">
                {profile?.full_name ?? user?.email ?? 'User'}
              </span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="min-w-[180px] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1.5 z-50 animate-fade-in"
            >
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{profile?.full_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {(workspaceMember?.role ?? profile?.role)?.replace('_', ' ')}
                </p>
              </div>

              <DropdownMenu.Item
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer outline-none"
                onSelect={() => setProfileOpen(true)}
              >
                <User className="h-4 w-4 text-slate-400" />
                Profile
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-1 border-t border-slate-100 dark:border-slate-700" />

              <DropdownMenu.Item
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer outline-none"
                onSelect={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        workspaceMember={workspaceMember}
      />
    </header>
  )
}
