'use client'

import { useState, useTransition } from 'react'
import { createWorkspace, joinWorkspace, switchWorkspace } from './actions'
import { Building2, KeyRound, Plus, ArrowRight, Loader2, Users, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase'

export default function WorkspaceOnboarding({ workspaces, initialView, loadError }) {
  const [view, setView] = useState(
    initialView === 'create' ? 'create'
    : initialView === 'join' ? 'join'
    : workspaces.length > 0 ? 'select'
    : 'options'
  )
  const [createError, setCreateError] = useState(null)
  const [joinError, setJoinError] = useState(null)
  const [isPending, startTransition] = useTransition()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function handleCreate(formData) {
    setCreateError(null)
    startTransition(async () => {
      const result = await createWorkspace(formData)
      if (result?.error) setCreateError(result.error)
    })
  }

  function handleJoin(formData) {
    setJoinError(null)
    startTransition(async () => {
      const result = await joinWorkspace(formData)
      if (result?.error) setJoinError(result.error)
    })
  }

  function handleSwitch(workspaceId) {
    startTransition(async () => {
      await switchWorkspace(workspaceId)
    })
  }

  const ROLE_LABELS = { super_admin: 'Admin', pm: 'PM', developer: 'Developer' }

  return (
    <div className="relative w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 15l6 6L23 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Donee</h1>
        <p className="text-slate-400 text-sm mt-1">
          {workspaces.length > 0 ? 'Select a workspace to continue' : 'Get started with a workspace'}
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        {loadError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm break-words">
            {loadError}
          </div>
        )}

        {/* Existing workspaces */}
        {view === 'select' && workspaces.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Your Workspaces</h2>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                disabled={isPending}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 transition-all text-left group disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-indigo-600/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{ws.name}</p>
                  <p className="text-slate-400 text-xs capitalize mt-0.5">{ROLE_LABELS[ws.role] ?? ws.role}</p>
                </div>
                {isPending ? (
                  <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                )}
              </button>
            ))}

            <div className="pt-3 border-t border-white/10 flex gap-2">
              <button
                onClick={() => setView('create')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New workspace
              </button>
              <button
                onClick={() => setView('join')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <KeyRound className="h-4 w-4" />
                Join workspace
              </button>
            </div>
          </div>
        )}

        {/* Options (no workspaces) */}
        {view === 'options' && (
          <div className="space-y-3">
            <h2 className="text-slate-300 text-sm text-center mb-6">
              Create a new workspace or join an existing one.
            </h2>
            <button
              onClick={() => setView('create')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/60 transition-all text-left group"
            >
              <div className="w-10 h-10 bg-indigo-600/40 rounded-xl flex items-center justify-center">
                <Plus className="h-5 w-5 text-indigo-300" />
              </div>
              <div>
                <p className="text-white font-semibold">Create workspace</p>
                <p className="text-slate-400 text-xs mt-0.5">Start fresh for your team</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-400 ml-auto transition-colors" />
            </button>

            <button
              onClick={() => setView('join')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-slate-500/50 transition-all text-left group"
            >
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <p className="text-white font-semibold">Join with invite code</p>
                <p className="text-slate-400 text-xs mt-0.5">Enter a code from your team</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-200 ml-auto transition-colors" />
            </button>
          </div>
        )}

        {/* Create workspace form */}
        {view === 'create' && (
          <form action={handleCreate} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => setView(workspaces.length > 0 ? 'select' : 'options')}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                ← Back
              </button>
              <h2 className="text-white font-semibold">Create Workspace</h2>
            </div>

            {createError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                Workspace name
              </label>
              <input
                name="name"
                type="text"
                placeholder="e.g. Acme HR, Intoit Group"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              {isPending ? 'Creating…' : 'Create Workspace'}
            </button>
          </form>
        )}

        {/* Join workspace form */}
        {view === 'join' && (
          <form action={handleJoin} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => setView(workspaces.length > 0 ? 'select' : 'options')}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                ← Back
              </button>
              <h2 className="text-white font-semibold">Join Workspace</h2>
            </div>

            {joinError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm">
                {joinError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                Invite code
              </label>
              <input
                name="code"
                type="text"
                placeholder="e.g. ABCD1234"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm uppercase tracking-widest"
              />
              <p className="text-slate-500 text-xs mt-1.5">Ask your workspace admin for an invite code.</p>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              {isPending ? 'Joining…' : 'Join Workspace'}
            </button>
          </form>
        )}
      </div>

      <button
        onClick={handleSignOut}
        className="mt-4 w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-sm transition-colors py-2"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  )
}
