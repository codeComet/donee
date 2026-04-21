const SUPABASE_URL = '__SUPABASE_URL__'
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_AUTH') {
    startAuth()
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

async function startAuth() {
  const verifier = generateVerifier()
  const challenge = await generateChallenge(verifier)
  const redirectUrl = chrome.identity.getRedirectURL()

  await setStorage('donee_pkce_verifier', verifier)

  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectUrl,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?${params}`

  const callbackUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, url => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(url)
      }
    })
  })

  const callbackSearchParams = new URL(callbackUrl).searchParams
  const code = callbackSearchParams.get('code')
  if (!code) throw new Error('No auth code in callback URL')

  const storedVerifier = await getStorage('donee_pkce_verifier')
  await removeStorage('donee_pkce_verifier')

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ auth_code: code, code_verifier: storedVerifier }),
  })

  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error_description || data.msg || 'Token exchange failed')

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

function generateVerifier() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function getStorage(key) {
  return new Promise(resolve => chrome.storage.local.get([key], r => resolve(r[key] ?? null)))
}

function setStorage(key, value) {
  return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve))
}

function removeStorage(key) {
  return new Promise(resolve => chrome.storage.local.remove([key], resolve))
}
