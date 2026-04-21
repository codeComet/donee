export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PM: 'pm',
  DEVELOPER: 'developer',
}

export const isSuperAdmin = profile => profile?.role === ROLES.SUPER_ADMIN
export const isPM = profile => profile?.role === ROLES.PM || isSuperAdmin(profile)
export const canManageUsers = profile => isSuperAdmin(profile)
export const canAccessAdmin = profile => isSuperAdmin(profile)
export const canAssignTask = profile => isSuperAdmin(profile) || isPM(profile)
export const canManageProject = (profile, project) => {
  if (!profile) return false
  if (isSuperAdmin(profile)) return true
  return profile.role === ROLES.PM && project?.pm_id === profile.id
}
export const canEditTask = (profile, task) => {
  if (!profile) return false
  if (isSuperAdmin(profile) || isPM(profile)) return true
  return task?.assigned_to === profile.id || task?.created_by === profile.id
}
