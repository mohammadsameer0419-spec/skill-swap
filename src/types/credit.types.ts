/**
 * Credit transaction type enum matching database schema
 */
export enum CreditTransactionType {
  EARNED = 'earned',
  SPENT = 'spent',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
}

/**
 * Credit transaction interface matching database schema
 */
export interface CreditTransaction {
  id: string
  user_id: string
  type: CreditTransactionType
  amount: number // Positive for earned/refund/unlocked, negative for spent/locked
  balance_after: number // Balance after this transaction
  session_id: string | null
  related_transaction_id: string | null
  description: string | null
  created_at: string
}

/**
 * Credit balance information
 */
export interface CreditBalance {
  total: number // Total Credits: The raw balance (sum of ALL transactions)
  available: number // Available to Spend: Total Credits - Reserved Credits
  reserved: number // Reserved Credits: Sum of reserved/pending transactions
}

/**
 * Transaction filters for queries
 */
export interface TransactionFilters {
  user_id: string
  type?: CreditTransactionType | CreditTransactionType[]
  session_id?: string
  from_date?: string // ISO timestamp
  to_date?: string // ISO timestamp
  limit?: number
  offset?: number
}

/**
 * Lock credits data
 */
export interface LockCreditsData {
  user_id: string
  amount: number
  session_id: string
}

/**
 * Unlock credits data
 */
export interface UnlockCreditsData {
  user_id: string
  amount: number
  session_id: string
}

/**
 * Transfer credits data
 */
export interface TransferCreditsData {
  learner_id: string
  teacher_id: string
  amount: number
  session_id: string
  description?: string | null
}

/**
 * Record transaction data
 */
export interface RecordTransactionData {
  user_id: string
  type: CreditTransactionType
  amount: number
  session_id?: string | null
  description?: string | null
}

/**
 * Database response type
 */
export type CreditResponse<T> = {
  data: T | null
  error: Error | null
}
