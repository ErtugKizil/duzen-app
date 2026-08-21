import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Holding, Debt, Transaction, Category, Goal } from './types'

function formatTRY(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR')
}

interface GoalHoldingLink {
  goal_id: string
  holding_id: string
}

export default function DashboardBoard({ user }: { user: User }) {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [links, setLinks] = useState<GoalHoldingLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [h, d, tx, cat, g, l] = await Promise.all([
        supabase.from('holdings').select('*'),
        supabase.from('debts').select('*'),
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).limit(5),
        supabase.from('categories').select('*'),
        supabase.from('goals').select('*'),
        supabase.from('goal_holdings').select('*'),
      ])
      if (h.data) setHoldings(h.data as Holding[])
      if (d.data) setDebts(d.data as Debt[])
      if (tx.data) setTransactions(tx.data as Transaction[])
      if (cat.data) setCategories(cat.data as Category[])
      if (g.data) setGoals(g.data as Goal[])
      if (l.data) setLinks(l.data as GoalHoldingLink[])
      setLoading(false)
    }
    load()
  }, [user.id])

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>
  }

  const totalAssets = holdings.reduce((s, h) => s + h.quantity * h.unit_price_try, 0)
  const totalDebts = debts.reduce((s, d) => s + Number(d.amount), 0)
  const netWorth = totalAssets - totalDebts
  const freedomScore = Math.max(0, Math.floor(netWorth / 10000))
  const freedomRatio = Math.min(Math.max(netWorth, 0) / 1000000, 1)

  const now = new Date()
  const thisMonthTx = transactions.filter((t) => {
    const dd = new Date(t.transaction_date)
    return dd.getMonth() === now.getMonth() && dd.getFullYear() === now.getFullYear()
  })
  const categoryById = (id: string | null) => categories.find((c) => c.id === id)
  const monthIncome = thisMonthTx.filter((t) => categoryById(t.category_id)?.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const monthExpense = thisMonthTx.filter((t) => categoryById(t.category_id)?.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const freedomGoal = goals.find((g) => g.name.toLocaleLowerCase('tr-TR').includes('özgürlük'))
  const freedomGoalHoldingIds = freedomGoal ? links.filter((l) => l.goal_id === freedomGoal.id).map((l) => l.holding_id) : []
  const freedomGoalCurrent = holdings.filter((h) => freedomGoalHoldingIds.includes(h.id)).reduce((s, h) => s + h.quantity * h.unit_price_try, 0)
  const freedomGoalRatio = freedomGoal ? Math.min(freedomGoalCurrent / freedomGoal.target_amount, 1) : 0

  const grouped = holdings.reduce<Record<string, number>>((acc, h) => {
    const val = h.quantity * h.unit_price_try
    acc[h.group_name] = (acc[h.group_name] || 0) + val
    return acc
  }, {})
  const maxGroupValue = Math.max(...Object.values(grouped), 1)

  return (
    <div>
      <div className="score-card">
        <div className="score-ring">
          <span className="score-number">{freedomScore}</span>
          <span className="score-label">puan</span>
        </div>
        <div className="score-info">
          <h2>Finansal Özgürlük Skoru</h2>
          <p>Hedef: 1.000.000 TL · {formatTRY(Math.max(netWorth, 0))} birikti</p>
          <div className="goal-progress-track">
            <div className="goal-progress-fill" style={{ width: `${freedomRatio * 100}%` }} />
          </div>
        </div>
      </div>

      {freedomGoal && (
        <div className="holdings-group">
          <h2>{freedomGoal.icon} Özgürlük Fonu İlerlemesi</h2>
          <div className="goal-progress-track">
            <div className="goal-progress-fill" style={{ width: `${freedomGoalRatio * 100}%` }} />
          </div>
          <p className="goal-amounts">{formatTRY(freedomGoalCurrent)} / {formatTRY(freedomGoal.target_amount)}</p>
        </div>
      )}

      <div className="finance-summary">
        <div className={`summary-card net ${netWorth >= 0 ? 'positive' : 'negative'}`}>
          <span className="summary-label">Net Servet</span>
          <span className="summary-value">{formatTRY(netWorth)}</span>
        </div>
        <div className="summary-card income">
          <span className="summary-label">Bu Ay Gelir</span>
          <span className="summary-value">{formatTRY(monthIncome)}</span>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">Bu Ay Gider</span>
          <span className="summary-value">{formatTRY(monthExpense)}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="holdings-group">
          <h2>Son İşlemler</h2>
          {transactions.length === 0 && <p className="empty-hint">Henüz işlem yok.</p>}
          {transactions.map((t) => {
            const cat = categoryById(t.category_id)
            return (
              <div key={t.id} className={`transaction-row type-${cat?.type ?? 'expense'}`}>
                <div className="tx-main">
                  <span className="tx-category">{cat?.name ?? 'Kategori silinmiş'}</span>
                  <span className="tx-date">{formatDate(t.transaction_date)}</span>
                </div>
                <span className="tx-amount">
                  {cat?.type === 'income' ? '+' : '-'}{formatTRY(Number(t.amount))}
                </span>
              </div>
            )
          })}
        </div>

        <div className="holdings-group">
          <h2>Yatırım Dağılımı</h2>
          {Object.keys(grouped).length === 0 && <p className="empty-hint">Henüz yatırım kaydın yok.</p>}
          <div className="distribution-list">
            {Object.entries(grouped).map(([group, value]) => (
              <div key={group} className="distribution-row">
                <span className="distribution-label">{group}</span>
                <div className="distribution-track">
                  <div className="distribution-fill" style={{ width: `${(value / maxGroupValue) * 100}%` }} />
                </div>
                <span className="distribution-value">{formatTRY(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="holdings-group">
        <h2>Hedef Durumu</h2>
        {goals.length === 0 && <p className="empty-hint">Henüz hedef eklemedin.</p>}
        <div className="goals-grid">
          {goals.map((goal) => {
            const ids = links.filter((l) => l.goal_id === goal.id).map((l) => l.holding_id)
            const current = holdings.filter((h) => ids.includes(h.id)).reduce((s, h) => s + h.quantity * h.unit_price_try, 0)
            const ratio = Math.min(current / goal.target_amount, 1)
            return (
              <div key={goal.id} className="goal-card mini">
                <span className="task-icon">{goal.icon}</span>
                <h3>{goal.name}</h3>
                <div className="goal-progress-track">
                  <div className="goal-progress-fill" style={{ width: `${ratio * 100}%` }} />
                </div>
                <p className="goal-percent">%{Math.round(ratio * 100)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
