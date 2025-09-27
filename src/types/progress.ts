import type { Timestamp } from 'firebase/firestore'

export type ProgressEntry = {
  id: string
  groupId: string
  uid: string
  date: string
  quantity: number
  notes?: string | null
  userDisplayName?: string | null
  userPhotoURL?: string | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}

export type ProgressLeaderboardEntry = {
  uid: string
  displayName: string
  photoURL: string | null
  totalQuantity: number
  entries: ProgressEntry[]
  completedAtTimestamp?: number
  completedOnDate?: string
}
