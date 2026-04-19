import { createClient } from './supabase'

// Fetch unread notifications for the current user (client-side)
export async function fetchUnreadNotifications(limit = 10) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*, task:tasks(title, project:projects(name))')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

// Mark a single notification as read
export async function markNotificationRead(id) {
  const supabase = createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)

  if (error) throw error
}

// Mark all notifications as read for the current user
export async function markAllNotificationsRead() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) throw error
}

// Subscribe to real-time notification inserts for the current user
export function subscribeToNotifications(userId, onNew) {
  const supabase = createClient()
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNew(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
