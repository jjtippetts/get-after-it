import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore'

import { db } from './firebase'

export const PROGRESS_COLLECTION = 'progress'

export type SaveProgressEntryInput = {
  groupId: string
  uid: string
  date: string
  quantity: number
  notes?: string
  userDisplayName?: string | null
  userPhotoURL?: string | null
}

export function progressCollectionRef() {
  return collection(db, PROGRESS_COLLECTION)
}

export function progressDocumentId(groupId: string, uid: string, date: string) {
  return `${groupId}_${uid}_${date}`
}

export async function saveProgressEntry({
  groupId,
  uid,
  date,
  quantity,
  notes,
  userDisplayName,
  userPhotoURL
}: SaveProgressEntryInput) {
  const normalizedDate = date
  const documentId = progressDocumentId(groupId, uid, normalizedDate)
  const progressRef = doc(db, PROGRESS_COLLECTION, documentId)
  const snapshot = await getDoc(progressRef)
  const now = serverTimestamp()
  const cleanedNotes = notes?.trim() ? notes.trim() : null

  if (snapshot.exists()) {
    const existing = snapshot.data()
    await setDoc(
      progressRef,
      {
        groupId,
        uid,
        date: normalizedDate,
        quantity,
        notes: cleanedNotes,
        userDisplayName: userDisplayName ?? existing.userDisplayName ?? null,
        userPhotoURL: userPhotoURL ?? existing.userPhotoURL ?? null,
        createdAt: existing.createdAt ?? now,
        updatedAt: now
      },
      { merge: true }
    )
  } else {
    await setDoc(progressRef, {
      groupId,
      uid,
      date: normalizedDate,
      quantity,
      notes: cleanedNotes,
      userDisplayName: userDisplayName ?? null,
      userPhotoURL: userPhotoURL ?? null,
      createdAt: now,
      updatedAt: now
    })
  }
}
