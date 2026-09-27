import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { canAssignTask, isSuperAdmin, isPM } from '../lib/permissions'
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '../lib/utils'
import Spinner from '../components/Spinner'
import RichTextEditor from '../components/RichTextEditor'
import ScreenshotPicker, { toScreenshot, validateScreenshot } from '../components/ScreenshotPicker'

export default function AddTaskPage({ profile, workspaceId }) {
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  const [screenshots, setScreenshots] = useState([])
  // Bumped on reset so the editor remounts with empty content
  const [formKey, setFormKey] = useState(0)
  const [form, setForm] = useState({
    title: '',
    description: '',
    project_id: '',
    priority: 'medium',
    status: 'backlog',
    assigned_to: canAssignTask(profile) ? '' : profile.id,
    estimation: '',
    deadline: '',
  })

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    // All workspace members can see projects scoped to their workspace
    // RLS enforces visibility; filter by workspace_id for correctness
    let q = supabase
      .from('projects')
      .select('id, name, color')
      .eq('is_archived', false)
      .eq('workspace_id', workspaceId)
      .order('name')

    if (isPM(profile) && !isSuperAdmin(profile)) {
      q = q.eq('pm_id', profile.id)
    }

    const { data } = await q
    const list = data || []
    setProjects(list)
    if (list.length > 0) setForm(f => ({ ...f, project_id: list[0].id }))
    setLoading(false)
  }, [profile.id, profile.role, workspaceId])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  useEffect(() => {
    if (canAssignTask(profile) && workspaceId) fetchMembers()
  }, [workspaceId])

  async function fetchMembers() {
    const { data } = await supabase
      .from('workspace_members')
      .select('user_id, role, user:profiles(id, full_name)')
      .eq('workspace_id', workspaceId)
      .order('user_id')
    const members = (data || [])
      .filter(m => m.user)
      .map(m => ({ id: m.user.id, full_name: m.user.full_name }))
      .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
    setMembers(members)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addScreenshots = list => {
    setError('')
    setScreenshots(prev => [...prev, ...list])
  }
  const removeScreenshot = id => setScreenshots(prev => prev.filter(s => s.id !== id))

  // Pasted images anywhere in the form become screenshots
  useEffect(() => {
    function onPaste(e) {
      const images = Array.from(e.clipboardData?.items ?? [])
        .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
        .map(i => i.getAsFile())
        .filter(Boolean)
      if (!images.length) return
      e.preventDefault()
      const valid = []
      for (const f of images) {
        const err = validateScreenshot(f)
        if (err) setError(err)
        else valid.push(toScreenshot(f, f.name && f.name !== 'image.png' ? f.name : `pasted-${Date.now()}.png`))
      }
      if (valid.length) addScreenshots(valid)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // Uploads screenshots and adds them as a single note on the task
  async function attachScreenshots(taskId) {
    const urls = []
    for (const [i, shot] of screenshots.entries()) {
      const ext = (shot.blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      const path = `${profile.id}/${Date.now()}-${i}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('task-images')
        .upload(path, shot.blob, { contentType: shot.blob.type })
      if (upErr) throw upErr
      urls.push(supabase.storage.from('task-images').getPublicUrl(path).data.publicUrl)
    }
    const html = urls.map((u, i) => `<img src="${u}" alt="Screenshot ${i + 1}">`).join('')
    const { error: noteErr } = await supabase.from('task_notes').insert({
      task_id: taskId,
      author_id: profile.id,
      content: html,
    })
    if (noteErr) throw noteErr
  }

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
        workspace_id: workspaceId,
        priority: form.priority || null,
        status: form.status || 'backlog',
        assigned_to: form.assigned_to || null,
        estimation: form.estimation ? parseFloat(form.estimation) : null,
        deadline: form.deadline || null,
        created_by: profile.id,
      })
      .select('id, title, project:projects(name)')
      .single()
    if (err) { setSaving(false); setError(err.message); return }

    let screenshotError = null
    if (screenshots.length) {
      try {
        await attachScreenshots(data.id)
      } catch (e) {
        screenshotError = e.message || 'Screenshot upload failed'
      }
    }
    setSaving(false)
    setSuccess({ ...data, screenshotCount: screenshotError ? 0 : screenshots.length, screenshotError })
  }

  function reset() {
    setSuccess(null)
    screenshots.forEach(s => URL.revokeObjectURL(s.url))
    setScreenshots([])
    setFormKey(k => k + 1)
    setForm({
      title: '',
      description: '',
      project_id: projects[0]?.id || '',
      priority: 'medium',
      status: 'backlog',
      assigned_to: canAssignTask(profile) ? '' : profile.id,
      estimation: '',
      deadline: '',
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
            : 'No projects in this workspace yet.'}
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
          {success.screenshotCount > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {success.screenshotCount} screenshot{success.screenshotCount > 1 ? 's' : ''} added to notes
            </p>
          )}
          {success.screenshotError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
              Task was created, but screenshots couldn&apos;t be attached: {success.screenshotError}
            </p>
          )}
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

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <RichTextEditor
          key={formKey}
          placeholder="Add details…"
          onChange={html => set('description', html)}
          // Images are handled by the window paste listener → screenshots
          onPaste={e => Array.from(e.clipboardData?.items ?? []).some(i => i.type.startsWith('image/'))}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Screenshots {screenshots.length > 0 && <span className="text-slate-400">({screenshots.length})</span>}
        </label>
        <ScreenshotPicker
          screenshots={screenshots}
          onAdd={addScreenshots}
          onRemove={removeScreenshot}
          onError={setError}
        />
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

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Deadline</label>
        <input
          type="date"
          value={form.deadline}
          onChange={e => set('deadline', e.target.value)}
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
        {saving ? (screenshots.length ? 'Creating & uploading…' : 'Creating…') : 'Create Task'}
      </button>
    </form>
  )
}
