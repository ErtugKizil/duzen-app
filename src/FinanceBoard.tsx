import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Category, Transaction } from './types'
import InvestmentsBoard from './InvestmentsBoard'
import DebtsBoard from './DebtsBoard'
import GoalsBoard from './GoalsBoard'
import AnalyticsBoard from './AnalyticsBoard'
import DashboardBoard from './DashboardBoard'

const TYPE_LABEL: Record<string, string> = {
  income: 'Gelir',
  expense: 'Gider',
  debt: 'Borç Ödemesi',
}

function formatTRY(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('tr-TR')
}

export default function FinanceBoard({ user }: { user: User }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [subTab, setSubTab] = useState<'ozet' | 'islemler' | 'yatirimlar' | 'borclar' | 'hedefler' | 'analizler'>('ozet')

  const [type, setType] = useState<'income' | 'expense' | 'debt'>('expense')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const loadData = async () => {
    setLoading(true)
    const [{ data: cats }, { data: txs }] = await Promise.all([
      supabase.from('categories').select('*').order('group_name'),
      supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).limit(50),
    ])
    if (cats) setCategories(cats as Category[])
    if (txs) setTransactions(txs as Transaction[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const categoriesForType = categories.filter((c) => c.type === type)
  const groupedCategories = categoriesForType.reduce<Record<string, Category[]>>((acc, c) => {
    acc[c.group_name] = acc[c.group_name] || []
    acc[c.group_name].push(c)
    return acc
  }, {})

  const resetForm = () => {
    setType('expense')
    setCategoryId('')
    setAmount('')
    setNote('')
    setDate(new Date().toISOString().split('T')[0])
    setShowForm(false)
  }

  const addTransaction = async (e: FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (!numAmount || !categoryId) return
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      category_id: categoryId,
      amount: numAmount,
      note: note.trim() || null,
      transaction_date: date,
    })
    if (!error) {
      resetForm()
      loadData()
    } else {
      alert('Hata: ' + error.message)
    }
  }

  const deleteTransaction = async (id: string) => {
    await supabase.from('transactions').delete().eq('id', id)
    loadData()
  }

  const categoryById = (id: string | null) => categories.find((c) => c.id === id)

  const now = new Date()
  const thisMonthTxs = transactions.filter((t) => {
    const d = new Date(t.transaction_date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const monthIncome = thisMonthTxs.filter((t) => categoryById(t.category_id)?.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const monthExpense = thisMonthTxs.filter((t) => categoryById(t.category_id)?.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const monthDebt = thisMonthTxs.filter((t) => categoryById(t.category_id)?.type === 'debt').reduce((s, t) => s + Number(t.amount), 0)
  const monthNet = monthIncome - monthExpense - monthDebt

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>
  }

  return (
    <div className="board">
      <div className="sub-tab-bar">
        <button className={subTab === 'ozet' ? 'sub-tab-btn active' : 'sub-tab-btn'} onClick={() => setSubTab('ozet')}>Özet</button>
        <button className={subTab === 'islemler' ? 'sub-tab-btn active' : 'sub-tab-btn'} onClick={() => setSubTab('islemler')}>İşlemler</button>
        <button className={subTab === 'yatirimlar' ? 'sub-tab-btn active' : 'sub-tab-btn'} onClick={() => setSubTab('yatirimlar')}>Yatırımlar</button>
        <button className={subTab === 'borclar' ? 'sub-tab-btn active' : 'sub-tab-btn'} onClick={() => setSubTab('borclar')}>Borçlar</button>
        <button className={subTab === 'hedefler' ? 'sub-tab-btn active' : 'sub-tab-btn'} onClick={() => setSubTab('hedefler')}>Hedefler</button>
        <button className={subTab === 'analizler' ? 'sub-tab-btn active' : 'sub-tab-btn'} onClick={() => setSubTab('analizler')}>Analizler</button>
      </div>

      {subTab === 'ozet' ? (
        <DashboardBoard user={user} />
      ) : subTab === 'yatirimlar' ? (
        <InvestmentsBoard user={user} />
      ) : subTab === 'borclar' ? (
        <DebtsBoard user={user} />
      ) : subTab === 'hedefler' ? (
        <GoalsBoard user={user} />
      ) : subTab === 'analizler' ? (
        <AnalyticsBoard user={user} />
      ) : (
      <>
      <div className="finance-summary">
        <div className="summary-card income">
          <span className="summary-label">Bu Ay Gelir</span>
          <span className="summary-value">{formatTRY(monthIncome)}</span>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">Bu Ay Gider</span>
          <span className="summary-value">{formatTRY(monthExpense)}</span>
        </div>
        <div className="summary-card debt">
          <span className="summary-label">Bu Ay Borç Ödemesi</span>
          <span className="summary-value">{formatTRY(monthDebt)}</span>
        </div>
        <div className={`summary-card net ${monthNet >= 0 ? 'positive' : 'negative'}`}>
          <span className="summary-label">Net Durum</span>
          <span className="summary-value">{formatTRY(monthNet)}</span>
        </div>
      </div>

      <button className="add-transaction-btn" onClick={() => setShowForm(true)}>
        + İşlem ekle
      </button>

      <div className="transactions-list">
        <h2>Son İşlemler</h2>
        {transactions.length === 0 && <p className="empty-hint">Henüz işlem yok.</p>}
        {transactions.map((t) => {
          const cat = categoryById(t.category_id)
          return (
            <div key={t.id} className={`transaction-row type-${cat?.type ?? 'expense'}`}>
              <div className="tx-main">
                <span className="tx-category">{cat?.name ?? 'Kategori silinmiş'}</span>
                <span className="tx-date">{formatDate(t.transaction_date)}</span>
                {t.note && <span className="tx-note">{t.note}</span>}
              </div>
              <div className="tx-right">
                <span className="tx-amount">
                  {cat?.type === 'income' ? '+' : '-'}{formatTRY(Number(t.amount))}
                </span>
                <button className="tx-delete" onClick={() => deleteTransaction(t.id)}>✕</button>
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <form className="modal-form" onClick={(e) => e.stopPropagation()} onSubmit={addTransaction}>
            <h2>Yeni İşlem</h2>

            <label>Tür</label>
            <div className="type-picker">
              {(['income', 'expense', 'debt'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  className={type === t ? `type-btn selected type-${t}` : 'type-btn'}
                  onClick={() => { setType(t); setCategoryId('') }}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <label>Kategori</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Seç...</option>
              {Object.entries(groupedCategories).map(([group, cats]) => (
                <optgroup key={group} label={group}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            <label>Tutar (TL)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />

            <label>Tarih</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

            <label>Not (opsiyonel)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn: Ocak kirası" />

            <div className="modal-actions">
              <button type="button" className="cancel-btn" onClick={resetForm}>Vazgeç</button>
              <button type="submit" className="save-btn">Kaydet</button>
            </div>
          </form>
        </div>
      )}
      </>
      )}
    </div>
  )
}
