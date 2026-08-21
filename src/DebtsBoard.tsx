import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Debt } from './types'

const CATEGORY_LABEL: Record<string, string> = {
  kredi_karti: 'Kredi Kartı',
  kredi: 'Kredi',
  taksit: 'Taksit',
}

function formatTRY(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export default function DebtsBoard({ user }: { user: User }) {
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<'kredi_karti' | 'kredi' | 'taksit'>('kredi_karti')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const loadDebts = async () => {
    setLoading(true)
    const { data } = await supabase.from('debts').select('*').order('created_at', { ascending: true })
    if (data) setDebts(data as Debt[])
    setLoading(false)
  }

  useEffect(() => {
    loadDebts()
  }, [])

  const resetForm = () => {
    setName('')
    setCategory('kredi_karti')
    setAmount('')
    setNote('')
    setShowForm(false)
  }

  const addDebt = async (e: FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (!name.trim() || !numAmount) return
    const { error } = await supabase.from('debts').insert({
      user_id: user.id,
      name: name.trim(),
      category,
      amount: numAmount,
      note: note.trim() || null,
    })
    if (!error) {
      resetForm()
      loadDebts()
    } else {
      alert('Hata: ' + error.message)
    }
  }

  const deleteDebt = async (id: string) => {
    await supabase.from('debts').delete().eq('id', id)
    loadDebts()
  }

  const grouped = debts.reduce<Record<string, Debt[]>>((acc, d) => {
    acc[d.category] = acc[d.category] || []
    acc[d.category].push(d)
    return acc
  }, {})

  const totalDebt = debts.reduce((sum, d) => sum + Number(d.amount), 0)

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>
  }

  return (
    <div>
      <div className="finance-summary">
        <div className="summary-card net negative">
          <span className="summary-label">Toplam Borç</span>
          <span className="summary-value">{formatTRY(totalDebt)}</span>
        </div>
      </div>

      <button className="add-transaction-btn" onClick={() => setShowForm(true)}>
        + Borç ekle
      </button>

      {Object.keys(grouped).length === 0 && <p className="empty-hint">Henüz borç kaydı yok, harika! 🎉</p>}

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="holdings-group">
          <h2>{CATEGORY_LABEL[cat]}</h2>
          <div className="holdings-table">
            {items.map((d) => (
              <div key={d.id} className="debt-row">
                <div className="debt-info">
                  <span className="debt-name">{d.name}</span>
                  {d.note && <span className="debt-note">{d.note}</span>}
                </div>
                <span className="debt-amount">{formatTRY(Number(d.amount))}</span>
                <button className="tx-delete" onClick={() => deleteDebt(d.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <form className="modal-form" onClick={(e) => e.stopPropagation()} onSubmit={addDebt}>
            <h2>Yeni Borç</h2>

            <label>Tür</label>
            <div className="type-picker">
              {(['kredi_karti', 'kredi', 'taksit'] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  className={category === c ? 'type-btn selected type-debt' : 'type-btn'}
                  onClick={() => setCategory(c)}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>

            <label>İsim</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Bonus Kart" required />

            <label>Güncel Tutar (TL)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />

            <label>Not (opsiyonel)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn: 6 taksit kaldı" />

            <div className="modal-actions">
              <button type="button" className="cancel-btn" onClick={resetForm}>Vazgeç</button>
              <button type="submit" className="save-btn">Kaydet</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
