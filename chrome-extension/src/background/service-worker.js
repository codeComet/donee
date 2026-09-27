const SUPABASE_URL = '__SUPABASE_URL__'
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SIGN_IN') {
    signInWithPassword(msg.email, msg.password)
      .then(session => sendResponse({ session }))
      .catch(err => sendResponse({ error: err.message }))
    return true
  }
  if (msg.type === 'SIGN_OUT') {
    signOut()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ error: err.message }))
    return true
  }
  if (msg.type === 'REFRESH_TOKEN') {
    refreshSession(msg.refresh_token)
      .then(session => sendResponse({ session }))
      .catch(err => sendResponse({ error: err.message }))
    return true
  }
})

async function signInWithPassword(email, password) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  })

  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error_description || data.msg || 'Sign in failed')

  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: data.user,
  }

  await setStorage('donee_auth', session)
  return session
}

async function refreshSession(refreshToken) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error_description || 'Token refresh failed')

  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: data.user,
  }

  await setStorage('donee_auth', session)
  return session
}

async function signOut() {
  const session = await getStorage('donee_auth')
  if (session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      })
    } catch (_) {
      // Ignore network errors on sign out
    }
  }
  await chrome.storage.local.clear()
}

function getStorage(key) {
  return new Promise(resolve => chrome.storage.local.get([key], r => resolve(r[key] ?? null)))
}

function setStorage(key, value) {
  return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve))
}
