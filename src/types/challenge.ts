import type { Timestamp } from 'firebase/firestore'

export type Challenge = {
  id: string
  groupId: string
  title: string
  targetQuantity: number
  goalDescription?: string | null
  startDate: string
  endDate?: string | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
