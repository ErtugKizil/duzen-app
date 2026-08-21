export interface Task {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  icon: string
  warning_threshold_days: number
  danger_threshold_days: number
  last_done_at: string | null
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  group_name: string
  type: 'income' | 'expense' | 'debt'
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  category_id: string | null
  amount: number
  note: string | null
  transaction_date: string
  created_at: string
}

export interface Holding {
  id: string
  user_id: string
  name: string
  group_name: string
  unit: string
  quantity: number
  unit_price_try: number
  updated_at: string
  created_at: string
}

export interface Debt {
  id: string
  user_id: string
  name: string
  category: 'kredi_karti' | 'kredi' | 'taksit'
  amount: number
  note: string | null
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  icon: string
  target_amount: number
  holding_id: string | null
  created_at: string
}
