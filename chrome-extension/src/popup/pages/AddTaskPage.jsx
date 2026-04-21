import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { canAssignTask, isSuperAdmin, isPM } from '../lib/permissions'
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '../lib/utils'
import Spinner from '../components/Spinner'

export default function AddTaskPage({ profile }) {
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    project_id: '',
    priority: 'medium',
    status: 'backlog',
    assigned_to: canAssignTask(profile) ? '' : profile.id,
    estimation: '',
  })

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('projects').select('id, name, color').eq('is_archived', false).order('name')

    if (isSuperAdmin(profile)) {
      // sees all projects
    } else if (isPM(profile)) {
      // only projects they manage
      q = q.eq('pm_id', profile.id)
    } else {
      // developer: projects they're a member of OR have assigned tasks in
      const [{ data: memberRows }, { data: taskRows }] = await Promise.all([
        supabase.from('project_members').select('project_id').eq('user_id', profile.id),
        supabase.from('tasks').select('project_id').eq('assigned_to', profile.id),
      ])
      const ids = [...new Set([
        ...(memberRows?.map(r => r.project_id) || []),
        ...(taskRows?.map(r => r.project_id) || []),
      ])]
      if (ids.length > 0) q = q.in('id', ids)
      else { setProjects([]); setLoading(false); return }
    }

    const { data } = await q
    const list = data || []
    setProjects(list)
    if (list.length > 0) setForm(f => ({ ...f, project_id: list[0].id }))
    setLoading(false)
  }, [profile.id, profile.role])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  useEffect(() => {
    if (canAssignTask(profile) && form.project_id) fetchMembers(form.project_id)
  }, [form.project_id])

  async function fetchMembers(_projectId) {
    // super admin and PM can assign to anyone
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
    setMembers(data || [])
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title required'); return }
    if (!form.project_id) { setError('Project required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('tasks')
      .insert({
        title: form.title.trim(),
        description: form.description || null,
        project_id: form.project_id,
        priority: form.priority || null,
        status: form.status || 'backlog',
        assigned_to: form.assigned_to || null,
        estimation: form.estimation ? parseFloat(form.estimation) : null,
        created_by: profile.id,
      })
      .select('title, project:projects(name)')
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setSuccess(data)
  }

  function reset() {
    setSuccess(null)
    setForm({
      title: '',
      description: '',
      project_id: projects[0]?.id || '',
      priority: 'medium',
      status: 'backlog',
      assigned_to: canAssignTask(profile) ? '' : profile.id,
      estimation: '',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="md" />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <p className="text-sm font-medium text-slate-700">No projects available</p>
        <p className="text-xs text-slate-500 mt-1">
          {isPM(profile) && !isSuperAdmin(profile)
            ? 'You have no projects assigned as PM.'
            : 'Join a project to create tasks.'}
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-4">
        <CheckCircle className="w-10 h-10 text-green-500" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Task created!</p>
          <p className="text-xs text-slate-500 mt-1">"{success.title}" in {success.project?.name}</p>
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
    <form onSubmit={handleSubmit} className="p-4 pb-6 space-y-3 popup-scroll">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
        <input
          autoFocus
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Task title…"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Project *</label>
        <select
          value={form.project_id}
          onChange={e => set('project_id', e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={e => set('priority', e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">None</option>
            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select
            value={form.status}
            onChange={e => set('status', e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {canAssignTask(profile) && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Assignee</label>
          <select
            value={form.assigned_to}
            onChange={e => set('assigned_to', e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Estimation (hrs)</label>
        <input
          type="number"
          min="0"
          step="0.5"
          value={form.estimation}
          onChange={e => set('estimation', e.target.value)}
          placeholder="e.g. 2.5"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {saving && <Spinner size="sm" className="border-white border-t-transparent" />}
        {saving ? 'Creating…' : 'Create Task'}
      </button>
    </form>
  )
}
