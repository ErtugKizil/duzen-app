import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Holding, Debt } from './types'

function formatTRY(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

interface Snapshot {
  id: string
  snapshot_date: string
  total_assets: number
  total_debts: number
  net_worth: number
}

const GROUP_COLORS: Record<string, string> = {
  'Döviz': '#7EDCC4',
  'Değerli Madenler': '#FFD97D',
  'Sermaye Piyasaları': '#FF8C69',
  'Nakit': '#B5D8FF',
}

export default function AnalyticsBoard({ user }: { user: User }) {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const [{ data: h }, { data: d }] = await Promise.all([
      supabase.from('holdings').select('*'),
      supabase.from('debts').select('*'),
    ])
    const holdingsData = (h as Holding[]) ?? []
    const debtsData = (d as Debt[]) ?? []
    setHoldings(holdingsData)
    setDebts(debtsData)

    const totalAssets = holdingsData.reduce((s, x) => s + x.quantity * x.unit_price_try, 0)
    const totalDebts = debtsData.reduce((s, x) => s + Number(x.amount), 0)
    const netWorth = totalAssets - totalDebts

    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('net_worth_snapshots')
      .upsert(
        { user_id: user.id, snapshot_date: today, total_assets: totalAssets, total_debts: totalDebts, net_worth: netWorth },
        { onConflict: 'user_id,snapshot_date' }
      )

    const { data: snaps } = await supabase
      .from('net_worth_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: true })
      .limit(400)
    if (snaps) setSnapshots(snaps as Snapshot[])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>
  }

  const totalAssets = holdings.reduce((s, x) => s + x.quantity * x.unit_price_try, 0)
  const totalDebts = debts.reduce((s, x) => s + Number(x.amount), 0)
  const netWorth = totalAssets - totalDebts

  const grouped = holdings.reduce<Record<string, number>>((acc, h) => {
    const val = h.quantity * h.unit_price_try
    acc[h.group_name] = (acc[h.group_name] || 0) + val
    return acc
  }, {})
  const maxGroupValue = Math.max(...Object.values(grouped), 1)

  const monthlySnapshots = Object.values(
    snapshots.reduce<Record<string, Snapshot>>((acc, s) => {
      const key = s.snapshot_date.slice(0, 7)
      acc[key] = s
      return acc
    }, {})
  ).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

  const maxSnapshot = Math.max(...monthlySnapshots.map((s) => Math.abs(s.net_worth)), 1)

  return (
    <div>
      <div className="finance-summary">
        <div className="summary-card net positive">
          <span className="summary-label">Toplam Varlık</span>
          <span className="summary-value">{formatTRY(totalAssets)}</span>
        </div>
        <div className="summary-card net negative">
          <span className="summary-label">Toplam Borç</span>
          <span className="summary-value">{formatTRY(totalDebts)}</span>
        </div>
        <div className={`summary-card net ${netWorth >= 0 ? 'positive' : 'negative'}`}>
          <span className="summary-label">Net Servet</span>
          <span className="summary-value">{formatTRY(netWorth)}</span>
        </div>
      </div>

      <div className="holdings-group">
        <h2>Net Servet Trendi</h2>
        {monthlySnapshots.length < 2 ? (
          <p className="empty-hint">Trend grafiği zamanla oluşacak — birkaç ay kullandıkça burada aylık bir çizgi birikecek.</p>
        ) : (
          <div className="trend-chart">
            {monthlySnapshots.map((s) => {
              const heightPct = Math.max((Math.abs(s.net_worth) / maxSnapshot) * 100, 3)
              const isNeg = s.net_worth < 0
              return (
                <div key={s.id} className="trend-bar-wrap" title={`${s.snapshot_date}: ${formatTRY(s.net_worth)}`}>
                  <div className={`trend-bar ${isNeg ? 'negative' : 'positive'}`} style={{ height: `${heightPct}%` }} />
                  <span className="trend-date">{new Date(s.snapshot_date).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="holdings-group">
        <h2>Varlık Dağılımı</h2>
        {Object.keys(grouped).length === 0 && <p className="empty-hint">Henüz yatırım kaydın yok.</p>}
        <div className="distribution-list">
          {Object.entries(grouped).map(([group, value]) => (
            <div key={group} className="distribution-row">
              <span className="distribution-label">{group}</span>
              <div className="distribution-track">
                <div
                  className="distribution-fill"
                  style={{ width: `${(value / maxGroupValue) * 100}%`, background: GROUP_COLORS[group] ?? 'var(--coral)' }}
                />
              </div>
              <span className="distribution-value">{formatTRY(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
