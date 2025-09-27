import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'

import { db } from './firebase'

export const CHALLENGES_COLLECTION = 'challenges'

export type ChallengeInput = {
  title: string
  targetQuantity: number
  goalDescription?: string
  startDate: string
  endDate?: string
}

export async function upsertChallenge(groupId: string, challenge: ChallengeInput) {
  const challengeRef = doc(db, CHALLENGES_COLLECTION, groupId)
  const snapshot = await getDoc(challengeRef)
  const now = serverTimestamp()
  const cleanedDescription = challenge.goalDescription?.trim()
  const payload = {
    groupId,
    title: challenge.title.trim(),
    targetQuantity: Number(challenge.targetQuantity),
    goalDescription: cleanedDescription ? cleanedDescription : null,
    startDate: challenge.startDate,
    endDate: challenge.endDate?.trim() ? challenge.endDate.trim() : null,
    updatedAt: now
  }

  if (snapshot.exists()) {
    await setDoc(
      challengeRef,
      {
        ...payload,
        createdAt: snapshot.data().createdAt ?? now
      },
      { merge: true }
    )
  } else {
    await setDoc(challengeRef, {
      ...payload,
      createdAt: now
    })
  }
}

export async function resetChallenge(groupId: string, overrides?: Partial<ChallengeInput>) {
  const challengeRef = doc(db, CHALLENGES_COLLECTION, groupId)
  const now = serverTimestamp()
  await setDoc(
    challengeRef,
    {
      ...(overrides?.title ? { title: overrides.title.trim() } : {}),
      ...(overrides?.targetQuantity !== undefined
        ? { targetQuantity: Number(overrides.targetQuantity) }
        : {}),
      ...(overrides?.goalDescription
        ? { goalDescription: overrides.goalDescription.trim() || null }
        : {}),
      ...(overrides?.endDate !== undefined ? { endDate: overrides.endDate?.trim() || null } : {}),
      startDate: overrides?.startDate ?? new Date().toISOString().slice(0, 10),
      updatedAt: now
    },
    { merge: true }
  )
}
