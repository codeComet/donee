import { createClient } from '@supabase/supabase-js'

const chromeStorage = {
  getItem: async key =>
    new Promise(resolve => chrome.storage.local.get([key], r => resolve(r[key] ?? null))),
  setItem: async (key, value) =>
    new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve)),
  removeItem: async key =>
    new Promise(resolve => chrome.storage.local.remove([key], resolve)),
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: chromeStorage,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

export async function getStoredSession() {
  return new Promise(resolve => chrome.storage.local.get(['donee_auth'], r => resolve(r.donee_auth ?? null)))
}

export async function clearStoredSession() {
  return new Promise(resolve => chrome.storage.local.remove(['donee_auth'], resolve))
}

export async function getStoredWorkspaceId() {
  return new Promise(resolve => chrome.storage.local.get(['donee_workspace_id'], r => resolve(r.donee_workspace_id ?? null)))
}

export async function setStoredWorkspaceId(workspaceId) {
  return new Promise(resolve => chrome.storage.local.set({ donee_workspace_id: workspaceId }, resolve))
}

export async function clearStoredWorkspaceId() {
  return new Promise(resolve => chrome.storage.local.remove(['donee_workspace_id'], resolve))
}
