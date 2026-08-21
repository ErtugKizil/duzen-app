import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Goal, Holding } from './types'

const GOAL_ICONS = ['🎯', '🏗️', '🚨', '🚗', '🏠', '🛶', '✈️', '📦']

function formatTRY(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

interface GoalHoldingLink {
  goal_id: string
  holding_id: string
}

export default function GoalsBoard({ user }: { user: User }) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [links, setLinks] = useState<GoalHoldingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState(GOAL_ICONS[0])
  const [targetAmount, setTargetAmount] = useState('')
  const [selectedHoldingIds, setSelectedHoldingIds] = useState<string[]>([])

  const loadData = async () => {
    setLoading(true)
    const [{ data: g }, { data: h }, { data: l }] = await Promise.all([
      supabase.from('goals').select('*').order('created_at', { ascending: true }),
      supabase.from('holdings').select('*').order('group_name'),
      supabase.from('goal_holdings').select('*'),
    ])
    if (g) setGoals(g as Goal[])
    if (h) setHoldings(h as Holding[])
    if (l) setLinks(l as GoalHoldingLink[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const resetForm = () => {
    setName('')
    setIcon(GOAL_ICONS[0])
    setTargetAmount('')
    setSelectedHoldingIds([])
    setShowForm(false)
    setEditingGoal(null)
  }

  const openAddGoal = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditGoal = (goal: Goal) => {
    setEditingGoal(goal)
    setName(goal.name)
    setIcon(goal.icon)
    setTargetAmount(String(goal.target_amount))
    setSelectedHoldingIds(links.filter((l) => l.goal_id === goal.id).map((l) => l.holding_id))
    setShowForm(true)
  }

  const toggleHolding = (id: string) => {
    setSelectedHoldingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submitGoal = async (e: FormEvent) => {
    e.preventDefault()
    const numTarget = parseFloat(targetAmount)
    if (!name.trim() || !numTarget) return

    if (editingGoal) {
      const { error } = await supabase
        .from('goals')
        .update({ name: name.trim(), icon, target_amount: numTarget })
        .eq('id', editingGoal.id)
      if (error) {
        alert('Hata: ' + error.message)
        return
      }
      await supabase.from('goal_holdings').delete().eq('goal_id', editingGoal.id)
      if (selectedHoldingIds.length > 0) {
        await supabase.from('goal_holdings').insert(
          selectedHoldingIds.map((hid) => ({ goal_id: editingGoal.id, holding_id: hid }))
        )
      }
    } else {
      const { data: newGoal, error } = await supabase
        .from('goals')
        .insert({ user_id: user.id, name: name.trim(), icon, target_amount: numTarget })
        .select()
        .single()
      if (error || !newGoal) {
        alert('Hata: ' + error?.message)
        return
      }
      if (selectedHoldingIds.length > 0) {
        await supabase.from('goal_holdings').insert(
          selectedHoldingIds.map((hid) => ({ goal_id: newGoal.id, holding_id: hid }))
        )
      }
    }

    resetForm()
    loadData()
  }

  const deleteGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id)
    loadData()
  }

  const holdingValue = (h: Holding) => h.quantity * h.unit_price_try

  const linkedHoldingsFor = (goalId: string) => {
    const ids = links.filter((l) => l.goal_id === goalId).map((l) => l.holding_id)
    return holdings.filter((h) => ids.includes(h.id))
  }

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>
  }

  return (
    <div>
      <button className="add-transaction-btn" onClick={openAddGoal}>
        + Hedef ekle
      </button>

      {goals.length === 0 && <p className="empty-hint">Henüz hedef eklemedin.</p>}

      <div className="goals-grid">
        {goals.map((goal) => {
          const linkedHoldings = linkedHoldingsFor(goal.id)
          const current = linkedHoldings.reduce((sum, h) => sum + holdingValue(h), 0)
          const ratio = Math.min(current / goal.target_amount, 1)
          return (
            <div key={goal.id} className="goal-card">
              <div className="task-card-top">
                <span className="task-icon">{goal.icon}</span>
                <button className="delete-btn" onClick={() => deleteGoal(goal.id)}>✕</button>
              </div>
              <h3>{goal.name}</h3>
              <div className="goal-progress-track">
                <div className="goal-progress-fill" style={{ width: `${ratio * 100}%` }} />
              </div>
              <p className="goal-amounts">
                {formatTRY(current)} / {formatTRY(goal.target_amount)}
              </p>
              <p className="goal-percent">%{Math.round(ratio * 100)} tamamlandı</p>
              {linkedHoldings.length > 0 ? (
                <p className="goal-linked">🔗 {linkedHoldings.map((h) => h.name).join(', ')}</p>
              ) : (
                <p className="goal-linked unlinked">Bağlı kalem yok</p>
              )}
              <button className="edit-goal-btn" onClick={() => openEditGoal(goal)}>
                Kalem Bağla / Düzenle
              </button>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <form className="modal-form" onClick={(e) => e.stopPropagation()} onSubmit={submitGoal}>
            <h2>{editingGoal ? 'Hedefi Düzenle' : 'Yeni Hedef'}</h2>

            <label>İkon seç</label>
            <div className="icon-picker">
              {GOAL_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  className={ic === icon ? 'icon-btn selected' : 'icon-btn'}
                  onClick={() => setIcon(ic)}
                >
                  {ic}
                </button>
              ))}
            </div>

            <label>Hedef adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Kano" required />

            <label>Hedef Tutar (TL)</label>
            <input type="number" step="0.01" min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />

            <label>Bağlı yatırım/nakit kalemleri (birden fazla seçilebilir)</label>
            <div className="holding-checklist">
              {holdings.map((h) => (
                <label key={h.id} className="holding-check-item">
                  <input
                    type="checkbox"
                    checked={selectedHoldingIds.includes(h.id)}
                    onChange={() => toggleHolding(h.id)}
                  />
                  {h.group_name} · {h.name}
                </label>
              ))}
            </div>

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
