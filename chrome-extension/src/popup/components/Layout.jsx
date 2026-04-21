import { CheckSquare, FolderKanban, Shield, LogOut } from 'lucide-react'
import { cn } from '../lib/utils'
import { canAccessAdmin, isPM } from '../lib/permissions'
import Avatar from './Avatar'

export default function Layout({ profile, activeTab, onTabChange, onSignOut, children }) {
  const tabs = [
    { id: 'task', label: 'Add Task', icon: CheckSquare, always: true },
    { id: 'project', label: 'Add Project', icon: FolderKanban, show: canAccessAdmin(profile) },
    { id: 'admin', label: 'Admin', icon: Shield, show: canAccessAdmin(profile) },
  ].filter(t => t.always || t.show)

  return (
    <div className="flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
            <CheckSquare className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-slate-900 text-sm">Donee</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Avatar name={profile?.full_name} avatarUrl={profile?.avatar_url} size="sm" />
            <span className="text-xs text-slate-600 max-w-[80px] truncate">{profile?.full_name?.split(' ')[0]}</span>
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

      {/* Tab bar — only shown when user has multiple tabs */}
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
