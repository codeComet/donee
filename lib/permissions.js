// Role hierarchy helpers — used in both client and server contexts.

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PM: 'pm',
  DEVELOPER: 'developer',
}

export function isSuperAdmin(profile) {
  return profile?.role === ROLES.SUPER_ADMIN
}

export function isPM(profile) {
  return profile?.role === ROLES.PM || isSuperAdmin(profile)
}

// Can a user edit/delete a task?
export function canEditTask(profile, task) {
  if (!profile) return false
  if (isSuperAdmin(profile)) return true
  if (isPM(profile)) return true
  // Developer can edit tasks assigned to them or created by them
  return task?.assigned_to === profile.id || task?.created_by === profile.id
}

// Can a user manage project settings (create/edit/archive)?
export function canManageProject(profile, project) {
  if (!profile) return false
  if (isSuperAdmin(profile)) return true
  if (profile.role === ROLES.PM && project?.pm_id === profile.id) return true
  return false
}

// Can a user add tasks to a project?
export function canAddTask(profile) {
  if (!profile) return false
  return true // any project member can add tasks per spec
}

// Can a user manage users (role changes)?
export function canManageUsers(profile) {
  return isSuperAdmin(profile)
}

// Can a user access the admin panel?
export function canAccessAdmin(profile) {
  return isSuperAdmin(profile)
}

// Can a user change task assignment?
export function canAssignTask(profile) {
  if (!profile) return false
  return isSuperAdmin(profile) || isPM(profile)
}
