import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore'

import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'

type Group = {
  id: string
  name: string
  description?: string
  inviteCode: string
  ownerId: string
}

type Member = {
  id: string
  userId: string
  displayName: string
  photoURL: string | null
  role: 'owner' | 'member'
  joinedAt?: Timestamp
}

type GoalType = 'numeric' | 'daily'

type Goal = {
  id: string
  groupId: string
  challengeType: string
  targetValue: number
  goalType: GoalType
  createdAt?: Timestamp
}

type ProgressEntry = {
  id: string
  groupId: string
  userId: string
  date: string
  quantity: number
  notes?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

type HistoryEntry = ProgressEntry & {
  displayName: string
  photoURL: string | null
  displayQuantity: string
}

const HISTORY_PAGE_SIZE = 10

export default function GroupDetails() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const currentUserId = user?.uid ?? null
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [membership, setMembership] = useState<Member | null>(null)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [goalChallengeType, setGoalChallengeType] = useState('')
  const [goalTargetValue, setGoalTargetValue] = useState('')
  const [goalType, setGoalType] = useState<GoalType>('numeric')
  const [loading, setLoading] = useState(true)
  const [savingGoal, setSavingGoal] = useState(false)
  const [resettingChallenge, setResettingChallenge] = useState(false)
  const [goalMessage, setGoalMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([])
  const [progressDate, setProgressDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [progressQuantity, setProgressQuantity] = useState('')
  const [progressNotes, setProgressNotes] = useState('')
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [savingProgress, setSavingProgress] = useState(false)
  const [historyPage, setHistoryPage] = useState(0)

  useEffect(() => {
    if (!groupId) {
      return
    }

    const groupRef = doc(db, 'groups', groupId)
    const unsubscribe = onSnapshot(
      groupRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setGroup(null)
          setError('Group not found.')
          setLoading(false)
          return
        }

        const data = snapshot.data()
        const descriptionValue = data.description
        setGroup({
          id: snapshot.id,
          name: data.name as string,
          description:
            typeof descriptionValue === 'string' && descriptionValue.length
              ? descriptionValue
              : undefined,
          inviteCode: data.inviteCode as string,
          ownerId: data.ownerId as string
        })
        setLoading(false)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError('Failed to load group details.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [groupId])

  useEffect(() => {
    if (!groupId) {
      return
    }

    const membershipsQuery = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId)
    )

    const unsubscribe = onSnapshot(
      membershipsQuery,
      (snapshot) => {
        const memberDocs: Member[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          return {
            id: docSnapshot.id,
            userId: data.userId as string,
            displayName:
              typeof data.displayName === 'string' && data.displayName.length
                ? (data.displayName as string)
                : 'Member',
            photoURL: (data.photoURL as string | null) ?? null,
            role: (data.role as 'owner' | 'member') ?? 'member',
            joinedAt: data.joinedAt as Timestamp | undefined
          }
        })
        memberDocs.sort((first, second) => {
          if (first.role === 'owner' && second.role !== 'owner') {
            return -1
          }
          if (first.role !== 'owner' && second.role === 'owner') {
            return 1
          }
          const firstTime = first.joinedAt?.toMillis() ?? 0
          const secondTime = second.joinedAt?.toMillis() ?? 0
          return firstTime - secondTime
        })
        setMembers(memberDocs)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError('Unable to load group members.')
      }
    )

    return () => unsubscribe()
  }, [groupId])

  useEffect(() => {
    if (!groupId || !user) {
      return
    }

    const membershipRef = doc(db, 'groupMembers', `${groupId}_${user.uid}`)
    const unsubscribe = onSnapshot(membershipRef, (snapshot) => {
      if (!snapshot.exists()) {
        setMembership(null)
        return
      }
      const data = snapshot.data()
      setMembership({
        id: snapshot.id,
        userId: data.userId as string,
        displayName:
          typeof data.displayName === 'string' && data.displayName.length
            ? (data.displayName as string)
            : 'Member',
        photoURL: (data.photoURL as string | null) ?? null,
        role: (data.role as 'owner' | 'member') ?? 'member',
        joinedAt: data.joinedAt as Timestamp | undefined
      })
    })

    return () => unsubscribe()
  }, [groupId, user])

  useEffect(() => {
    if (!groupId) {
      return
    }

    const goalRef = doc(db, 'goals', groupId)
    const unsubscribe = onSnapshot(goalRef, (snapshot) => {
      if (!snapshot.exists()) {
        setGoal(null)
        setGoalChallengeType('')
        setGoalTargetValue('')
        setGoalType('numeric')
        return
      }

      const data = snapshot.data()
      const challengeType = (data.challengeType as string) ?? ''
      const targetValue = data.targetValue as number | undefined
      const rawGoalType = data.goalType
      const storedGoalType: GoalType = rawGoalType === 'daily' ? 'daily' : 'numeric'
      setGoal({
        id: snapshot.id,
        groupId: (data.groupId as string) ?? groupId,
        challengeType,
        targetValue: typeof targetValue === 'number' ? targetValue : 0,
        goalType: storedGoalType,
        createdAt: data.createdAt as Timestamp | undefined
      })
      setGoalChallengeType(challengeType)
      setGoalTargetValue(
        typeof targetValue === 'number' && Number.isFinite(targetValue)
          ? String(targetValue)
          : ''
      )
      setGoalType(storedGoalType)
    })

    return () => unsubscribe()
  }, [groupId])

  useEffect(() => {
    if (!groupId) {
      return
    }

    const progressQuery = query(collection(db, 'progress'), where('groupId', '==', groupId))
    const unsubscribe = onSnapshot(
      progressQuery,
      (snapshot) => {
        const entries: ProgressEntry[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          const notesValue = data.notes
          return {
            id: docSnapshot.id,
            groupId: (data.groupId as string) ?? groupId,
            userId: (data.userId as string) ?? '',
            date: (data.date as string) ?? '',
            quantity: Number(data.quantity) || 0,
            notes:
              typeof notesValue === 'string' && notesValue.length
                ? notesValue
                : undefined,
            createdAt: data.createdAt as Timestamp | undefined,
            updatedAt: data.updatedAt as Timestamp | undefined
          }
        })
        setProgressEntries(entries)
        setProgressError(null)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setProgressError('Unable to load progress entries.')
      }
    )

    return () => unsubscribe()
  }, [groupId])

  const isOwner = useMemo(() => membership?.role === 'owner', [membership])

  const historyEntries = useMemo<HistoryEntry[]>(() => {
    const memberLookup = new Map(members.map((member) => [member.userId, member]))
    const isDailyGoal = goal?.goalType === 'daily'

    return [...progressEntries]
      .sort((first, second) => {
        const firstTime = first.createdAt?.toMillis() ?? 0
        const secondTime = second.createdAt?.toMillis() ?? 0
        if (firstTime === secondTime) {
          return second.date.localeCompare(first.date)
        }
        return secondTime - firstTime
      })
      .map((entry) => {
        const member = memberLookup.get(entry.userId)
        const quantityLabel = isDailyGoal
          ? '+1 day'
          : `+${entry.quantity}`
        return {
          ...entry,
          displayName: member?.displayName ?? 'Member',
          photoURL: member?.photoURL ?? null,
          displayQuantity: quantityLabel
        }
      })
  }, [goal?.goalType, members, progressEntries])

  const paginatedHistoryEntries = useMemo(() => {
    const startIndex = historyPage * HISTORY_PAGE_SIZE
    return historyEntries.slice(startIndex, startIndex + HISTORY_PAGE_SIZE)
  }, [historyEntries, historyPage])

  const historyPageCount = useMemo(() => {
    return Math.ceil(historyEntries.length / HISTORY_PAGE_SIZE)
  }, [historyEntries.length])

  useEffect(() => {
    if (!historyPageCount) {
      setHistoryPage(0)
      return
    }

    setHistoryPage((currentPage) => {
      const maxPageIndex = historyPageCount - 1
      return Math.min(currentPage, maxPageIndex)
    })
  }, [historyPageCount])

  const aggregatedProgress = useMemo(() => {
    const memberLookup = new Map(members.map((member) => [member.userId, member]))
    const grouped = new Map<string, ProgressEntry[]>()
    const isDailyGoal = goal?.goalType === 'daily'

    for (const entry of progressEntries) {
      const existing = grouped.get(entry.userId)
      if (existing) {
        existing.push(entry)
      } else {
        grouped.set(entry.userId, [entry])
      }
    }

    const rows = Array.from(grouped.entries()).map(([userId, entries]) => {
      const sortedEntries = [...entries].sort((first, second) => {
        if (first.date === second.date) {
          const firstTime = first.createdAt?.toMillis() ?? 0
          const secondTime = second.createdAt?.toMillis() ?? 0
          return firstTime - secondTime
        }
        return first.date < second.date ? -1 : 1
      })

      let total = 0
      let completedAt: Date | null = null

      for (const entry of sortedEntries) {
        const entryValue = isDailyGoal ? 1 : entry.quantity
        total += entryValue

        if (!completedAt && goal?.targetValue) {
          if (total >= goal.targetValue) {
            const timestamp = entry.createdAt?.toDate()
            completedAt = timestamp ?? new Date(`${entry.date}T00:00:00`)
          }
        }
      }

      const member = memberLookup.get(userId)

      return {
        userId,
        displayName: member?.displayName ?? 'Member',
        photoURL: member?.photoURL ?? null,
        total,
        completedAt,
        entries: sortedEntries
      }
    })

    for (const member of members) {
      if (!grouped.has(member.userId)) {
        rows.push({
          userId: member.userId,
          displayName: member.displayName,
          photoURL: member.photoURL,
          total: 0,
          completedAt: null,
          entries: []
        })
      }
    }

    rows.sort((first, second) => {
      if (first.completedAt && second.completedAt) {
        return first.completedAt.getTime() - second.completedAt.getTime()
      }
      if (first.completedAt) {
        return -1
      }
      if (second.completedAt) {
        return 1
      }

      return second.total - first.total
    })

    const earliestCompletion = rows
      .filter((row) => row.completedAt)
      .reduce<number | null>((earliest, row) => {
        if (!row.completedAt) {
          return earliest
        }
        const completedTime = row.completedAt.getTime()
        if (earliest === null || completedTime < earliest) {
          return completedTime
        }
        return earliest
      }, null)

    const winners = earliestCompletion
      ? rows.filter((row) => row.completedAt?.getTime() === earliestCompletion)
      : []

    const groupTotal = rows.reduce((sum, row) => sum + row.total, 0)

    return { rows, winners, groupTotal }
  }, [goal?.goalType, goal?.targetValue, members, progressEntries])

  const currentUserProgress = useMemo(() => {
    if (!currentUserId) {
      return null
    }

    return aggregatedProgress.rows.find((row) => row.userId === currentUserId) ?? null
  }, [aggregatedProgress, currentUserId])

  const handleSaveGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!groupId || !isOwner) {
      return
    }

    if (!goalChallengeType.trim()) {
      setGoalMessage('Please provide a challenge type.')
      return
    }

    const parsedTargetValue = Number(goalTargetValue)
    if (!Number.isFinite(parsedTargetValue) || parsedTargetValue <= 0) {
      setGoalMessage('Target value must be a positive number.')
      return
    }

    setSavingGoal(true)
    setGoalMessage(null)

    try {
      const normalizedGoalType: GoalType = goalType === 'daily' ? 'daily' : 'numeric'
      const goalRef = doc(db, 'goals', groupId)
      await setDoc(
        goalRef,
        {
          groupId,
          challengeType: goalChallengeType.trim(),
          targetValue: parsedTargetValue,
          goalType: normalizedGoalType,
          updatedAt: serverTimestamp(),
          createdAt: goal?.createdAt ?? serverTimestamp()
        },
        { merge: true }
      )
      setGoalType(normalizedGoalType)
      setGoalMessage('Goal updated!')
    } catch (saveError) {
      console.error(saveError)
      setGoalMessage('Unable to save goal right now.')
    } finally {
      setSavingGoal(false)
    }
  }

  const handleResetChallenge = async () => {
    if (!groupId || !isOwner) {
      return
    }

    const confirmed = window.confirm(
      'Resetting will remove the goal and all logged progress for this challenge. Continue?'
    )

    if (!confirmed) {
      return
    }

    setResettingChallenge(true)
    setGoalMessage(null)

    try {
      const goalRef = doc(db, 'goals', groupId)
      await deleteDoc(goalRef)

      const progressQuery = query(collection(db, 'progress'), where('groupId', '==', groupId))
      const snapshot = await getDocs(progressQuery)
      if (!snapshot.empty) {
        const batch = writeBatch(db)
        snapshot.forEach((progressDoc) => {
          batch.delete(progressDoc.ref)
        })
        await batch.commit()
      }

      setGoal(null)
      setGoalChallengeType('')
      setGoalTargetValue('')
      setGoalType('numeric')
      setProgressMessage(null)
      setProgressError(null)
      setGoalMessage('Challenge reset. Set a new goal to get started again!')
    } catch (resetError) {
      console.error(resetError)
      setGoalMessage('Failed to reset challenge. Please try again.')
    } finally {
      setResettingChallenge(false)
    }
  }

  const handleSaveProgress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!groupId || !user || !membership) {
      return
    }

    if (!progressDate) {
      setProgressError('Please select a date to log progress.')
      return
    }

    const isDailyGoal = goal?.goalType === 'daily'
    const existingEntry = progressEntries.find(
      (entry) => entry.userId === user.uid && entry.date === progressDate
    )

    if (isDailyGoal && existingEntry) {
      setProgressError('You already logged progress for this day. Awesome consistency!')
      return
    }

    let quantityToSave = 1
    if (!isDailyGoal) {
      const parsedQuantity = Number(progressQuantity)
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        setProgressError('Quantity must be a positive number.')
        return
      }
      quantityToSave = parsedQuantity
    }

    setSavingProgress(true)
    setProgressError(null)
    setProgressMessage(null)

    try {
      const trimmedNotes = progressNotes.trim()
      const progressDocId = `${groupId}_${user.uid}_${progressDate}`
      const progressRef = doc(db, 'progress', progressDocId)

      await setDoc(
        progressRef,
        {
          groupId,
          userId: user.uid,
          date: progressDate,
          quantity: quantityToSave,
          notes: trimmedNotes.length ? trimmedNotes : null,
          updatedAt: serverTimestamp(),
          createdAt: existingEntry?.createdAt ?? serverTimestamp()
        },
        { merge: true }
      )

      setProgressMessage('Progress saved! Great job.')
      if (!isDailyGoal) {
        setProgressQuantity('')
      }
      setProgressNotes('')
    } catch (saveError) {
      console.error(saveError)
      setProgressError('Unable to save progress right now.')
    } finally {
      setSavingProgress(false)
    }
  }

  const handleDeleteProgress = async (entry: ProgressEntry) => {
    if (!groupId || !user || user.uid !== entry.userId) {
      return
    }

    const confirmed = window.confirm('Delete this progress log?')
    if (!confirmed) {
      return
    }

    setDeletingEntryId(entry.id)
    setProgressError(null)
    setProgressMessage(null)

    try {
      const progressRef = doc(db, 'progress', entry.id)
      await deleteDoc(progressRef)
      setProgressMessage('Progress log deleted.')
    } catch (deleteError) {
      console.error(deleteError)
      setProgressError('Unable to delete this progress entry right now.')
    } finally {
      setDeletingEntryId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-300">
        <span>Loading group…</span>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="space-y-4 text-slate-300">
        <p>We couldn&apos;t find that group.</p>
        <Link
          to="/groups"
          className="text-sm font-medium text-sky-400 transition hover:text-sky-300"
        >
          Back to groups
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">{group.name}</h1>
          {group.description ? (
            <p className="mt-2 text-sm text-slate-300">{group.description}</p>
          ) : null}
          <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">
            Invite code: <span className="font-mono text-slate-300">{group.inviteCode}</span>
          </p>
        </div>
        <Link
          to="/groups"
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:text-white"
        >
          Back to groups
        </Link>
      </div>

      {membership ? null : (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-amber-100">
          <p className="font-medium">You&apos;re viewing this group as a guest.</p>
          <p className="mt-2 text-sm">
            Ask the owner for the invite code to join and participate in the challenge.
          </p>
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-white">Current goal</h2>
        {goal ? (
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>
              Challenge: <span className="font-medium text-white">{goal.challengeType}</span>
            </p>
            <p>
              Goal type:{' '}
              <span className="font-medium text-white">
                {goal.goalType === 'daily'
                  ? 'Daily habit (one log per day)'
                  : 'Numeric total'}
              </span>
            </p>
            <p>
              {goal.goalType === 'daily' ? 'Target days' : 'Target total'}:{' '}
              <span className="font-medium text-white">{goal.targetValue}</span>
            </p>
            <p>
              {goal.goalType === 'daily'
                ? 'Your days logged'
                : 'Your total logged'}:{' '}
              <span className="font-medium text-white">
                {currentUserProgress?.total ?? 0}
              </span>
            </p>
            {goal.targetValue ? (
              <p>
                Progress:{' '}
                <span className="font-medium text-white">
                  {Math.min(currentUserProgress?.total ?? 0, goal.targetValue)}/{goal.targetValue}
                </span>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No goal configured yet.</p>
        )}

        {isOwner ? (
          <form onSubmit={handleSaveGoal} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="challenge-type" className="text-sm font-medium text-slate-200">
                Challenge type
              </label>
              <input
                id="challenge-type"
                type="text"
                value={goalChallengeType}
                onChange={(event) => setGoalChallengeType(event.target.value)}
                placeholder="Workout days"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="goal-type" className="text-sm font-medium text-slate-200">
                Goal type
              </label>
              <select
                id="goal-type"
                value={goalType}
                onChange={(event) =>
                  setGoalType(event.target.value === 'daily' ? 'daily' : 'numeric')
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="numeric">Numeric total (minutes, miles, reps, etc.)</option>
                <option value="daily">Daily habit (log once per day)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="target-value" className="text-sm font-medium text-slate-200">
                Target value
              </label>
              <input
                id="target-value"
                type="number"
                min="1"
                value={goalTargetValue}
                onChange={(event) => setGoalTargetValue(event.target.value)}
                placeholder="5"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingGoal}
                className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingGoal ? 'Saving…' : 'Save goal'}
              </button>
              {goalMessage ? <p className="text-sm text-slate-300">{goalMessage}</p> : null}
            </div>
            <button
              type="button"
              onClick={handleResetChallenge}
              disabled={resettingChallenge}
              className="inline-flex items-center justify-center rounded-lg border border-red-500/60 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resettingChallenge ? 'Resetting…' : 'Reset challenge'}
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-white">Log progress</h2>
        {membership ? (
          <form onSubmit={handleSaveProgress} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="progress-date" className="text-sm font-medium text-slate-200">
                  Date
                </label>
                <input
                  id="progress-date"
                  type="date"
                  value={progressDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setProgressDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>
              {goal?.goalType === 'daily' ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-200">Daily log</p>
                  <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                    Each submission counts as one day completed.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="progress-quantity" className="text-sm font-medium text-slate-200">
                    Quantity
                  </label>
                  <input
                    id="progress-quantity"
                    type="number"
                    min="1"
                    step="any"
                    value={progressQuantity}
                    onChange={(event) => setProgressQuantity(event.target.value)}
                    placeholder="1"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>
              )}
              <div className="space-y-2 sm:col-span-3">
                <label htmlFor="progress-notes" className="text-sm font-medium text-slate-200">
                  Notes (optional)
                </label>
                <textarea
                  id="progress-notes"
                  value={progressNotes}
                  onChange={(event) => setProgressNotes(event.target.value)}
                  placeholder="What did you accomplish today?"
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingProgress}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProgress ? 'Saving…' : 'Log progress'}
              </button>
              {progressMessage ? <p className="text-sm text-slate-300">{progressMessage}</p> : null}
              {progressError ? <p className="text-sm text-red-400">{progressError}</p> : null}
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Join the group to log your progress.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-white">Group history</h2>
        <div className="mt-4">
          {historyEntries.length ? (
            <>
              <ul className="mt-3 space-y-3">
                {paginatedHistoryEntries.map((entry) => {
                  const loggedForDate = new Date(`${entry.date}T00:00:00`)
                  const loggedForLabel = Number.isNaN(loggedForDate.getTime())
                    ? entry.date || 'Unknown date'
                    : loggedForDate.toLocaleDateString()
                  const submittedDate = entry.createdAt?.toDate()
                  const submittedLabel = submittedDate
                    ? submittedDate.toLocaleString()
                    : 'Submission time unavailable'

                  return (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">{entry.displayName}</p>
                          <p className="text-xs text-slate-500">Logged for {loggedForLabel}</p>
                          <p className="text-xs text-slate-500">Submitted on {submittedLabel}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400">{entry.displayQuantity}</span>
                          {entry.userId === user?.uid ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteProgress(entry)}
                              disabled={deletingEntryId === entry.id}
                              className="text-xs font-medium text-rose-300 transition hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingEntryId === entry.id ? 'Deleting…' : 'Delete'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {entry.notes ? (
                        <p className="mt-2 text-xs text-slate-400">{entry.notes}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              {historyPageCount > 1 ? (
                <div className="mt-4 flex flex-col items-center justify-between gap-3 text-xs text-slate-400 sm:flex-row">
                  <p>
                    Showing {historyPage * HISTORY_PAGE_SIZE + 1}–
                    {Math.min((historyPage + 1) * HISTORY_PAGE_SIZE, historyEntries.length)} of{' '}
                    {historyEntries.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((page) => Math.max(page - 1, 0))}
                      disabled={historyPage === 0}
                      className="rounded-md border border-slate-800 px-3 py-1 font-medium text-slate-300 transition hover:border-sky-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Previous
                    </button>
                    <span className="font-medium text-slate-500">
                      Page {historyPage + 1} of {historyPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryPage((page) =>
                          Math.min(page + 1, Math.max(historyPageCount - 1, 0))
                        )
                      }
                      disabled={historyPage >= historyPageCount - 1}
                      className="rounded-md border border-slate-800 px-3 py-1 font-medium text-slate-300 transition hover:border-sky-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No progress logged yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-white">Leaderboard</h2>
        {goal && aggregatedProgress.winners.length ? (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="font-medium">
              {aggregatedProgress.winners.length > 1 ? 'We have winners!' : 'We have a winner!'}
            </p>
            <p className="mt-2 text-sm">
              {aggregatedProgress.winners
                .map((winner) => winner.displayName)
                .join(', ')}{' '}
              {aggregatedProgress.winners.length > 1 ? 'hit' : 'hit'} the goal first.
            </p>
          </div>
        ) : null}

        {aggregatedProgress.rows.length ? (
          <ul className="mt-4 space-y-3">
            {aggregatedProgress.rows.map((row) => (
              <li
                key={row.userId}
                className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  {row.photoURL ? (
                    <img
                      src={row.photoURL}
                      alt={row.displayName}
                      className="h-8 w-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold uppercase text-slate-200">
                      {row.displayName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{row.displayName}</p>
                    {row.completedAt ? (
                      <p className="text-xs text-emerald-400">
                        Goal met on {row.completedAt.toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {goal?.goalType === 'daily'
                          ? `${row.entries.length} ${row.entries.length === 1 ? 'day' : 'days'} logged`
                          : `${row.entries.length} entr${row.entries.length === 1 ? 'y' : 'ies'}`}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-sky-300">
                  {goal?.goalType === 'daily'
                    ? `${row.total} day${row.total === 1 ? '' : 's'}`
                    : row.total}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No progress logged yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-white">Members</h2>
        {members.length ? (
          <ul className="mt-4 space-y-3">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {member.photoURL ? (
                    <img
                      src={member.photoURL}
                      alt={member.displayName}
                      className="h-8 w-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold uppercase text-slate-200">
                      {member.displayName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{member.displayName}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{member.role}</p>
                  </div>
                </div>
                {member.joinedAt ? (
                  <p className="text-xs text-slate-500">
                    Joined {member.joinedAt.toDate().toLocaleDateString()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No members yet.</p>
        )}
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  )
}
