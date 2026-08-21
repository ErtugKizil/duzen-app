import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import Login from './Login'
import TaskBoard from './TaskBoard'
import FinanceBoard from './FinanceBoard'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'ev' | 'finans'>('ev')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <div>
      <nav className="tab-bar">
        <button className={tab === 'ev' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('ev')}>
          🏡 Ev Düzeni
        </button>
        <button className={tab === 'finans' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('finans')}>
          💰 Finans
        </button>
        <button onClick={() => supabase.auth.signOut()} className="signout-btn tab-signout">
          Çıkış yap
        </button>
      </nav>

      {tab === 'ev' ? <TaskBoard user={session.user} /> : <FinanceBoard user={session.user} />}
    </div>
  )
}

export default App
