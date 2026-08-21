import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Holding } from './types'

function formatTRY(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export default function InvestmentsBoard({ user }: { user: User }) {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, { quantity: string; unit_price_try: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const loadHoldings = async () => {
    setLoading(true)
    const { data } = await supabase.from('holdings').select('*').order('group_name')
    if (data) {
      setHoldings(data as Holding[])
      const d: Record<string, { quantity: string; unit_price_try: string }> = {}
      data.forEach((h: Holding) => {
        d[h.id] = { quantity: String(h.quantity), unit_price_try: String(h.unit_price_try) }
      })
      setDrafts(d)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadHoldings()
  }, [])

  const updateDraft = (id: string, field: 'quantity' | 'unit_price_try', value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const saveHolding = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return
    setSavingId(id)
    const quantity = parseFloat(draft.quantity) || 0
    const unit_price_try = parseFloat(draft.unit_price_try) || 0
    const { error } = await supabase
      .from('holdings')
      .update({ quantity, unit_price_try, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSavingId(null)
    if (error) {
      alert('Kaydedilemedi: ' + error.message)
      return
    }
    setHoldings((prev) => prev.map((h) => (h.id === id ? { ...h, quantity, unit_price_try } : h)))
    setSavedId(id)
    setTimeout(() => setSavedId(null), 1500)
  }

  const grouped = holdings.reduce<Record<string, Holding[]>>((acc, h) => {
    acc[h.group_name] = acc[h.group_name] || []
    acc[h.group_name].push(h)
    return acc
  }, {})

  const totalValue = holdings.reduce((sum, h) => sum + h.quantity * h.unit_price_try, 0)

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>
  }

  return (
    <div>
      <div className="finance-summary">
        <div className="summary-card net positive">
          <span className="summary-label">Toplam Yatırım Değeri</span>
          <span className="summary-value">{formatTRY(totalValue)}</span>
        </div>
      </div>

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="holdings-group">
          <h2>{group}</h2>
          <div className="holdings-table">
            {items.map((h) => {
              const draft = drafts[h.id] ?? { quantity: '0', unit_price_try: '0' }
              const qty = parseFloat(draft.quantity) || 0
              const price = parseFloat(draft.unit_price_try) || 0
              const value = qty * price
              return (
                <div key={h.id} className="holding-row">
                  <span className="holding-name">{h.name}</span>
                  <div className="holding-inputs">
                    <div className="holding-field">
                      <label>Miktar ({h.unit})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={draft.quantity}
                        onChange={(e) => updateDraft(h.id, 'quantity', e.target.value)}
                      />
                    </div>
                    {h.unit !== 'TL' ? (
                      <div className="holding-field">
                        <label>Birim Fiyat (TL)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={draft.unit_price_try}
                          onChange={(e) => updateDraft(h.id, 'unit_price_try', e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="holding-field holding-field-empty" />
                    )}
                  </div>
                  <button
                    type="button"
                    className="holding-save-btn"
                    onClick={() => saveHolding(h.id)}
                    disabled={savingId === h.id}
                  >
                    {savingId === h.id ? '...' : savedId === h.id ? '✓' : 'Kaydet'}
                  </button>
                  <span className="holding-value">{formatTRY(value)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
