import { useState, useEffect } from 'react'
import { CheckCircle, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isSuperAdmin } from '../lib/permissions'
import Spinner from '../components/Spinner'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#64748b',
]

export default function AddProjectPage({ profile, workspaceId }) {
  const [pms, setPms] = useState([])
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: COLORS[0],
    pm_id: isSuperAdmin(profile) ? '' : profile.id,
  })

  useEffect(() => {
    if (isSuperAdmin(profile) && workspaceId) fetchPMs()
  }, [workspaceId])

  async function fetchPMs() {
    const { data } = await supabase
      .from('workspace_members')
      .select('user_id, role, user:profiles(id, full_name)')
      .eq('workspace_id', workspaceId)
      .in('role', ['pm', 'super_admin'])
      .order('user_id')
    const list = (data || [])
      .filter(m => m.user)
      .map(m => ({ id: m.user.id, full_name: m.user.full_name }))
      .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
    setPms(list)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('projects')
      .insert({
        name: form.name.trim(),
        description: form.description || null,
        color: form.color,
        pm_id: form.pm_id || null,
        created_by: profile.id,
        workspace_id: workspaceId,
      })
      .select('name')
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setSuccess(data)
  }

  function reset() {
    setSuccess(null)
    setForm({ name: '', description: '', color: COLORS[0], pm_id: isSuperAdmin(profile) ? '' : profile.id })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-4">
        <CheckCircle className="w-10 h-10 text-green-500" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Project created!</p>
          <p className="text-xs text-slate-500 mt-1">"{success.name}"</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3 popup-scroll">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
        <input
          autoFocus
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Project name…"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Optional…"
          rows={2}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => set('color', c)}
              className="w-6 h-6 rounded-full transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                outline: form.color === c ? `2px solid ${c}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </div>

      {isSuperAdmin(profile) && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Project Manager</label>
          <select
            value={form.pm_id}
            onChange={e => set('pm_id', e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">No PM</option>
            {pms.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {saving && <Spinner size="sm" className="border-white border-t-transparent" />}
        {saving ? 'Creating…' : 'Create Project'}
      </button>
    </form>
  )
}
