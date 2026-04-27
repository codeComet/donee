export const WORKSPACE_COOKIE = 'donee_workspace_id'

export function getWorkspaceId(cookieStore) {
  return cookieStore.get(WORKSPACE_COOKIE)?.value ?? null
}
