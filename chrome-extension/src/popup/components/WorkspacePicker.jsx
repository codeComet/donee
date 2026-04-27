import { Building2 } from 'lucide-react'
import { cn } from '../lib/utils'

const ROLE_LABEL = { super_admin: 'Admin', pm: 'PM', developer: 'Dev' }
const ROLE_COLOR = {
  super_admin: 'bg-indigo-100 text-indigo-700',
  pm: 'bg-violet-100 text-violet-700',
  developer: 'bg-slate-100 text-slate-600',
}

export default function WorkspacePicker({ workspaces, onSelect }) {
  return (
    <div className="flex flex-col bg-white min-h-[200px]">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-800">Select a workspace</p>
        <p className="text-xs text-slate-500 mt-0.5">Choose which workspace to work in</p>
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-2">
          <Building2 className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No workspaces found</p>
          <p className="text-xs text-slate-400">Ask your admin to invite you to a workspace.</p>
        </div>
      ) : (
        <div className="py-1">
          {workspaces.map(ws => (
            <button
              key={ws.workspace_id}
              onClick={() => onSelect(ws)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{ws.workspace?.name}</p>
              </div>
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0', ROLE_COLOR[ws.role] ?? ROLE_COLOR.developer)}>
                {ROLE_LABEL[ws.role] ?? ws.role}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
