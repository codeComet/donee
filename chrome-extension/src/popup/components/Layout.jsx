import { CheckSquare, FolderKanban, Shield, LogOut, Building2, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { canAccessAdmin } from '../lib/permissions'
import Avatar from './Avatar'

export default function Layout({ profile, workspace, workspaces, activeTab, onTabChange, onSignOut, onSwitchWorkspace, children }) {
  const tabs = [
    { id: 'task', label: 'Add Task', icon: CheckSquare, always: true },
    { id: 'project', label: 'Add Project', icon: FolderKanban, show: canAccessAdmin(profile) },
    { id: 'admin', label: 'Admin', icon: Shield, show: canAccessAdmin(profile) },
  ].filter(t => t.always || t.show)

  const canSwitch = workspaces?.length > 1

  return (
    <div className="flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
            <CheckSquare className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-slate-900 text-sm">Donee</span>
        </div>

        {/* Workspace badge */}
        {workspace && (
          <button
            onClick={canSwitch ? onSwitchWorkspace : undefined}
            disabled={!canSwitch}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 max-w-[110px] min-w-0 transition-colors',
              canSwitch && 'hover:bg-indigo-100 cursor-pointer'
            )}
            title={canSwitch ? 'Switch workspace' : workspace.name}
          >
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{workspace.name}</span>
            {canSwitch && <ChevronDown className="w-3 h-3 flex-shrink-0" />}
          </button>
        )}

        {/* User + sign out */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <div className="flex items-center gap-1.5">
            <Avatar name={profile?.full_name} avatarUrl={profile?.avatar_url} size="sm" />
            <span className="text-xs text-slate-600 max-w-[70px] truncate">{profile?.full_name?.split(' ')[0]}</span>
          </div>
          <button
            onClick={onSignOut}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="flex border-b border-slate-100 bg-white">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      <main>{children}</main>
    </div>
  )
}
