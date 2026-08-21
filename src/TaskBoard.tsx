import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Task } from './types'

const ICONS = ['🧹', '🍳', '🧺', '🍽️', '🛒', '🧽', '🪴', '💧', '📦', '🐾']
const MAX_BALL = 62
const MIN_BALL = 14

function daysSince(dateStr: string) {
  const then = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

function referenceDate(task: Task) {
  return task.last_done_at ?? task.created_at
}

function getStatus(task: Task) {
  const days = daysSince(referenceDate(task))
  if (days >= task.danger_threshold_days) return 'danger'
  if (days >= task.warning_threshold_days) return 'warning'
  return 'ok'
}

function ballSizes(task: Task) {
  if (!task.last_done_at) {
    return { doneD: MIN_BALL, undoneD: MAX_BALL }
  }
  const days = daysSince(task.last_done_at)
  const ratio = Math.min(days / task.danger_threshold_days, 1)
  const doneD = MIN_BALL + (MAX_BALL - MIN_BALL) * (1 - ratio)
  const undoneD = MIN_BALL + (MAX_BALL - MIN_BALL) * ratio
  return { doneD, undoneD }
}

export default function TaskBoard({ user }: { user: User }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [subtaskParent, setSubtaskParent] = useState<Task | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [warningDays, setWarningDays] = useState(3)
  const [dangerDays, setDangerDays] = useState(7)
  const [lastDoneInput, setLastDoneInput] = useState('')

  const loadTasks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error && data) setTasks(data as Task[])
    setLoading(false)
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const resetForm = () => {
    setName('')
    setIcon(ICONS[0])
    setWarningDays(3)
    setDangerDays(7)
    setLastDoneInput('')
    setShowForm(false)
    setSubtaskParent(null)
  }

  const openAddTask = () => {
    setSubtaskParent(null)
    setShowForm(true)
  }

  const openAddSubtask = (parent: Task) => {
    setSubtaskParent(parent)
    setIcon(parent.icon)
    setWarningDays(parent.warning_threshold_days)
    setDangerDays(parent.danger_threshold_days)
    setShowForm(true)
  }

  const addTask = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      name: name.trim(),
      icon,
      parent_id: subtaskParent ? subtaskParent.id : null,
      warning_threshold_days: warningDays,
      danger_threshold_days: dangerDays,
      last_done_at: lastDoneInput ? new Date(lastDoneInput).toISOString() : null,
    })
    if (!error) {
      resetForm()
      loadTasks()
    } else {
      alert('Hata: ' + error.message)
    }
  }

  const markDone = async (taskId: string) => {
    await supabase
      .from('tasks')
      .update({ last_done_at: new Date().toISOString() })
      .eq('id', taskId)
    loadTasks()
  }

  const deleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId)
    loadTasks()
  }

  const topLevel = tasks.filter((t) => !t.parent_id)
  const subtasksOf = (id: string) => tasks.filter((t) => t.parent_id === id)

  const statusLabel = (task: Task) => {
    const days = daysSince(referenceDate(task))
    if (!task.last_done_at) {
      return days === 0 ? 'Henüz yapılmadı · bugün eklendi' : `Henüz yapılmadı · ${days} gündür bekliyor`
    }
    return days === 0 ? 'Bugün yapıldı' : `${days} gündür yapılmadı`
  }

  const buttonLabel = (task: Task) => {
    const days = daysSince(referenceDate(task))
    return task.last_done_at && days === 0 ? 'Bugün yapıldı ✓' : 'Yaptım ✓'
  }

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>
  }

  return (
    <div className="board">
      <header className="board-header">
        <h1>Ev Düzeni 🏡</h1>
      </header>

      <div className="board-layout">
        <div className="task-grid">
          {topLevel.map((task) => {
            const status = getStatus(task)
            const subs = subtasksOf(task.id)
            return (
              <div key={task.id} className={`task-card status-${status}`}>
                <div className="task-card-top">
                  <span className="task-icon">{task.icon}</span>
                  <button className="delete-btn" onClick={() => deleteTask(task.id)}>
                    ✕
                  </button>
                </div>
                <h3>{task.name}</h3>
                <p className={`days-text status-text-${status}`}>{statusLabel(task)}</p>
                <button className={`done-btn status-${status}`} onClick={() => markDone(task.id)}>
                  {buttonLabel(task)}
                </button>

                {subs.length > 0 && (
                  <div className="subtasks">
                    {subs.map((sub) => (
                      <div key={sub.id} className={`subtask-chip status-${getStatus(sub)}`}>
                        <span className="subtask-name">{sub.icon} {sub.name}</span>
                        <span className="subtask-days">{statusLabel(sub)}</span>
                        <div className="subtask-actions">
                          <button className="subtask-done-btn" onClick={() => markDone(sub.id)} title="Yaptım">✓</button>
                          <button className="subtask-delete-btn" onClick={() => deleteTask(sub.id)} title="Sil">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button className="add-subtask-btn" onClick={() => openAddSubtask(task)}>
                  + Alt görev
                </button>
              </div>
            )
          })}

          <button className="add-card" onClick={openAddTask}>
            + Görev ekle
          </button>
        </div>

        <aside className="ball-pit">
          <h2>Görevler</h2>
          <p className="pit-hint">Yeşil = yapıldı, mercan = yapılmadı</p>
          <div className="ball-pit-list">
            {tasks.map((task) => {
              const { doneD, undoneD } = ballSizes(task)
              return (
                <div key={task.id} className="pit-item">
                  <div className="pit-balls">
                    <div className="pit-ball done" style={{ width: doneD, height: doneD }} />
                    <div className="pit-ball undone" style={{ width: undoneD, height: undoneD }} />
                  </div>
                  <span className="pit-label">{task.icon} {task.name}</span>
                </div>
              )
            })}
          </div>
        </aside>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <form className="modal-form" onClick={(e) => e.stopPropagation()} onSubmit={addTask}>
            <h2>{subtaskParent ? `${subtaskParent.icon} ${subtaskParent.name} · Alt görev` : 'Yeni görev'}</h2>

            <label>İkon seç</label>
            <div className="icon-picker">
              {ICONS.map((ic) => (
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

            <label>Görev adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={subtaskParent ? 'Örn: Banyo' : 'Örn: Bulaşık'} required />

            <label>En son ne zaman yapıldı? (opsiyonel)</label>
            <input type="date" value={lastDoneInput} onChange={(e) => setLastDoneInput(e.target.value)} max={new Date().toISOString().split('T')[0]} />

            <div className="threshold-row">
              <div>
                <label>Sarı uyarı (gün)</label>
                <input type="number" min={1} value={warningDays} onChange={(e) => setWarningDays(Number(e.target.value))} />
              </div>
              <div>
                <label>Kırmızı uyarı (gün)</label>
                <input type="number" min={1} value={dangerDays} onChange={(e) => setDangerDays(Number(e.target.value))} />
              </div>
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
