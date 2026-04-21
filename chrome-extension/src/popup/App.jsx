import { useState, useEffect } from 'react'
import { supabase, getStoredSession } from './lib/supabase'
import { isTokenExpired } from './lib/utils'
import { canAccessAdmin, isPM } from './lib/permissions'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import AddTaskPage from './pages/AddTaskPage'
import AddProjectPage from './pages/AddProjectPage'
import AdminPage from './pages/AdminPage'
import { FullPageSpinner } from './components/Spinner'

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, session: null, profile: null })
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
            if (profile) setAuthState({ loading: false, session, profile })
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
        if (profile) { setAuthState({ loading: false, session, profile }); return }
      }

      const stored = await getStoredSession()
      if (stored && !isTokenExpired(stored.expires_at)) {
        const { data, error } = await supabase.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
        })
        if (!error && data.session) {
          const profile = await fetchProfile(data.session.user.id)
          if (profile) { setAuthState({ loading: false, session: data.session, profile }); return }
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
              if (profile) { setAuthState({ loading: false, session: data.session, profile }); return }
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

  async function handleSignIn(session) {
    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (error || !data.session) return
    const profile = await fetchProfile(data.session.user.id)
    if (profile) setAuthState({ loading: false, session: data.session, profile })
  }

  async function handleSignOut() {
    await chrome.runtime.sendMessage({ type: 'SIGN_OUT' })
    await supabase.auth.signOut()
    setAuthState({ loading: false, session: null, profile: null })
    setTab('task')
  }

  if (authState.loading) return <FullPageSpinner />

  if (!authState.session || !authState.profile) {
    return <LoginPage onSignIn={handleSignIn} />
  }

  const effectiveTab = (() => {
    if (tab === 'admin' && !canAccessAdmin(authState.profile)) return 'task'
    if (tab === 'project' && !canAccessAdmin(authState.profile)) return 'task'
    return tab
  })()

  return (
    <Layout
      profile={authState.profile}
      activeTab={effectiveTab}
      onTabChange={setTab}
      onSignOut={handleSignOut}
    >
      {effectiveTab === 'task' && <AddTaskPage profile={authState.profile} />}
      {effectiveTab === 'project' && canAccessAdmin(authState.profile) && <AddProjectPage profile={authState.profile} />}
      {effectiveTab === 'admin' && canAccessAdmin(authState.profile) && <AdminPage profile={authState.profile} />}
    </Layout>
  )
}
