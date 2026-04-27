import { useState, useEffect } from 'react'
import { supabase, getStoredSession, getStoredWorkspaceId, setStoredWorkspaceId } from './lib/supabase'
import { isTokenExpired } from './lib/utils'
import { canAccessAdmin } from './lib/permissions'
import Layout from './components/Layout'
import WorkspacePicker from './components/WorkspacePicker'
import LoginPage from './pages/LoginPage'
import AddTaskPage from './pages/AddTaskPage'
import AddProjectPage from './pages/AddProjectPage'
import AdminPage from './pages/AdminPage'
import { FullPageSpinner } from './components/Spinner'

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, session: null, profile: null })
  const [workspaceState, setWorkspaceState] = useState({ workspaces: [], workspaceId: null, workspaceMember: null })
  const [pickingWorkspace, setPickingWorkspace] = useState(false)
  const [tab, setTab] = useState('task')

  useEffect(() => {
    initAuth()

    const listener = async changes => {
      if (changes.donee_auth?.newValue) {
        const stored = changes.donee_auth.newValue
        if (!isTokenExpired(stored.expires_at)) {
          const { data: { session } } = await supabase.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
          })
          if (session) {
            const profile = await fetchProfile(session.user.id)
            if (profile) {
              const ws = await initWorkspace(session.user.id)
              setAuthState({ loading: false, session, profile })
              setWorkspaceState(ws)
            }
          }
        }
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  async function initAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && !isTokenExpired(session.expires_at)) {
        const profile = await fetchProfile(session.user.id)
        if (profile) {
          const ws = await initWorkspace(session.user.id)
          setAuthState({ loading: false, session, profile })
          setWorkspaceState(ws)
          return
        }
      }

      const stored = await getStoredSession()
      if (stored && !isTokenExpired(stored.expires_at)) {
        const { data, error } = await supabase.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
        })
        if (!error && data.session) {
          const profile = await fetchProfile(data.session.user.id)
          if (profile) {
            const ws = await initWorkspace(data.session.user.id)
            setAuthState({ loading: false, session: data.session, profile })
            setWorkspaceState(ws)
            return
          }
        }
      }

      if (stored?.refresh_token) {
        try {
          const response = await chrome.runtime.sendMessage({ type: 'REFRESH_TOKEN', refresh_token: stored.refresh_token })
          if (response?.session) {
            const { data } = await supabase.auth.setSession({
              access_token: response.session.access_token,
              refresh_token: response.session.refresh_token,
            })
            if (data.session) {
              const profile = await fetchProfile(data.session.user.id)
              if (profile) {
                const ws = await initWorkspace(data.session.user.id)
                setAuthState({ loading: false, session: data.session, profile })
                setWorkspaceState(ws)
                return
              }
            }
          }
        } catch (_) {}
      }

      setAuthState({ loading: false, session: null, profile: null })
    } catch (err) {
      console.error('Auth init error:', err)
      setAuthState({ loading: false, session: null, profile: null })
    }
  }

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email, role')
      .eq('id', userId)
      .single()
    return data
  }

  async function fetchWorkspaceMemberships(userId) {
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspace:workspaces(id, name)')
      .eq('user_id', userId)
      .order('workspace_id')
    return data || []
  }

  async function initWorkspace(userId) {
    const memberships = await fetchWorkspaceMemberships(userId)
    if (memberships.length === 0) return { workspaces: [], workspaceId: null, workspaceMember: null }

    const storedId = await getStoredWorkspaceId()
    const match = storedId ? memberships.find(m => m.workspace_id === storedId) : null

    if (match) {
      return { workspaces: memberships, workspaceId: match.workspace_id, workspaceMember: match }
    }

    // Auto-select if only one workspace
    if (memberships.length === 1) {
      await setStoredWorkspaceId(memberships[0].workspace_id)
      return { workspaces: memberships, workspaceId: memberships[0].workspace_id, workspaceMember: memberships[0] }
    }

    // Multiple workspaces but none stored — trigger picker
    return { workspaces: memberships, workspaceId: null, workspaceMember: null }
  }

  async function handleSelectWorkspace(membership) {
    await setStoredWorkspaceId(membership.workspace_id)
    setWorkspaceState(prev => ({ ...prev, workspaceId: membership.workspace_id, workspaceMember: membership }))
    setPickingWorkspace(false)
  }

  async function handleSignIn(session) {
    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (error || !data.session) return
    const profile = await fetchProfile(data.session.user.id)
    if (profile) {
      const ws = await initWorkspace(data.session.user.id)
      setAuthState({ loading: false, session: data.session, profile })
      setWorkspaceState(ws)
    }
  }

  async function handleSignOut() {
    await chrome.runtime.sendMessage({ type: 'SIGN_OUT' })
    await supabase.auth.signOut()
    setAuthState({ loading: false, session: null, profile: null })
    setWorkspaceState({ workspaces: [], workspaceId: null, workspaceMember: null })
    setPickingWorkspace(false)
    setTab('task')
  }

  if (authState.loading) return <FullPageSpinner />

  if (!authState.session || !authState.profile) {
    return <LoginPage onSignIn={handleSignIn} />
  }

  // Need workspace selection
  if (!workspaceState.workspaceId || pickingWorkspace) {
    return (
      <WorkspacePicker
        workspaces={workspaceState.workspaces}
        onSelect={handleSelectWorkspace}
      />
    )
  }

  // Merge workspace role into profile so all permission checks use workspace role
  const effectiveProfile = {
    ...authState.profile,
    role: workspaceState.workspaceMember?.role ?? authState.profile.role,
  }

  const effectiveTab = (() => {
    if (tab === 'admin' && !canAccessAdmin(effectiveProfile)) return 'task'
    if (tab === 'project' && !canAccessAdmin(effectiveProfile)) return 'task'
    return tab
  })()

  return (
    <Layout
      profile={effectiveProfile}
      workspace={workspaceState.workspaceMember?.workspace}
      workspaces={workspaceState.workspaces}
      activeTab={effectiveTab}
      onTabChange={setTab}
      onSignOut={handleSignOut}
      onSwitchWorkspace={() => setPickingWorkspace(true)}
    >
      {effectiveTab === 'task' && (
        <AddTaskPage
          profile={effectiveProfile}
          workspaceId={workspaceState.workspaceId}
        />
      )}
      {effectiveTab === 'project' && canAccessAdmin(effectiveProfile) && (
        <AddProjectPage
          profile={effectiveProfile}
          workspaceId={workspaceState.workspaceId}
        />
      )}
      {effectiveTab === 'admin' && canAccessAdmin(effectiveProfile) && (
        <AdminPage
          profile={effectiveProfile}
          workspaceId={workspaceState.workspaceId}
        />
      )}
    </Layout>
  )
}
