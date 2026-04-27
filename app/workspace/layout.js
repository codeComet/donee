import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSideClient } from '@/lib/supabase'

export const metadata = { title: 'Workspace — Donee' }

export default async function WorkspaceLayout({ children }) {
  const cookieStore = await cookies()
  const supabase = createServerSideClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>
      {children}
    </div>
  )
}
