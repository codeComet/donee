import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export const metadata = { title: 'Admin — Donee' }

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, color')
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Sidebar profile={profile} projects={projects ?? []} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar user={user} profile={profile} />
        <main className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
