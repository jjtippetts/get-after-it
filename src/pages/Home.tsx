import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  QueryConstraint,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where
} from 'firebase/firestore'

import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'
import { resetChallenge, upsertChallenge, type ChallengeInput } from '../lib/challenges'
import { saveProgressEntry } from '../lib/progress'
import type { Challenge } from '../types/challenge'
import type { ProgressEntry, ProgressLeaderboardEntry } from '../types/progress'

const GROUP_STORAGE_KEY = 'get-after-it:group-id'

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function getInitialGroupId() {
  if (typeof window === 'undefined') {
    return 'default'
  }
  return window.localStorage.getItem(GROUP_STORAGE_KEY) || 'default'
}

function normalizeGroupId(value: string) {
  return value.trim() || 'default'
}

export default function HomePage() {
  const { user } = useAuth()
  const [groupId, setGroupId] = useState(() => getInitialGroupId())
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [entries, setEntries] = useState<ProgressEntry[]>([])
  const [loadingChallenge, setLoadingChallenge] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [challengeError, setChallengeError] = useState<string | null>(null)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [savingProgress, setSavingProgress] = useState(false)
  const [savingChallenge, setSavingChallenge] = useState(false)

  const [progressForm, setProgressForm] = useState(() => ({
    date: getTodayIsoDate(),
    quantity: 0,
    notes: ''
  }))

  const [challengeForm, setChallengeForm] = useState<ChallengeInput>(() => ({
    title: 'Daily Challenge',
    targetQuantity: 1,
    goalDescription: '',
    startDate: getTodayIsoDate(),
    endDate: ''
  }))

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(GROUP_STORAGE_KEY, groupId)
    }
  }, [groupId])

  useEffect(() => {
    setLoadingChallenge(true)
    setChallengeError(null)
    const challengeRef = doc(db, 'challenges', groupId)
    const unsubscribe = onSnapshot(
      challengeRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Omit<Challenge, 'id'>
          setChallenge({ ...data, id: snapshot.id })
          setChallengeForm({
            title: data.title || 'Daily Challenge',
            targetQuantity: data.targetQuantity,
            goalDescription: data.goalDescription ?? '',
            startDate: data.startDate,
            endDate: data.endDate ?? ''
          })
        } else {
          setChallenge(null)
          setChallengeForm({
            title: 'Daily Challenge',
            targetQuantity: 1,
            goalDescription: '',
            startDate: getTodayIsoDate(),
            endDate: ''
          })
        }
        setLoadingChallenge(false)
      },
      (error) => {
        console.error('Failed to load challenge', error)
        setChallengeError('We were unable to load the current challenge.')
        setLoadingChallenge(false)
      }
    )

    return () => unsubscribe()
  }, [groupId])

  useEffect(() => {
    setLoadingEntries(true)
    setProgressError(null)

    const constraints: QueryConstraint[] = [where('groupId', '==', groupId)]
    if (challenge?.startDate) {
      constraints.push(where('date', '>=', challenge.startDate))
    }
    constraints.push(orderBy('date', 'asc'))

    const entriesQuery = query(collection(db, 'progress'), ...constraints)

    const unsubscribe = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<ProgressEntry, 'id'>)
        }))
        setEntries(docs)
        setLoadingEntries(false)
      },
      (error) => {
        console.error('Failed to load progress entries', error)
        setProgressError('We were unable to load progress entries.')
        setLoadingEntries(false)
      }
    )

    return () => unsubscribe()
  }, [groupId, challenge?.startDate])

  const personalEntries = useMemo(() => {
    if (!user) return []
    return [...entries]
      .filter((entry) => entry.uid === user.uid)
      .sort((a, b) => (a.date === b.date ? (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0) : b.date.localeCompare(a.date)))
  }, [entries, user])

  const leaderboard = useMemo<ProgressLeaderboardEntry[]>(() => {
    const orderedEntries = [...entries].sort((a, b) => {
      if (a.date === b.date) {
        const aTime = a.updatedAt?.toMillis() ?? 0
        const bTime = b.updatedAt?.toMillis() ?? 0
        return aTime - bTime
      }
      return a.date.localeCompare(b.date)
    })

    const map = new Map<string, ProgressLeaderboardEntry & { runningTotal: number }>()

    for (const entry of orderedEntries) {
      const existing = map.get(entry.uid)
      const fallbackName = entry.uid === user?.uid
        ? user.displayName?.trim() || user.email || 'You'
        : `Member ${entry.uid.slice(0, 6)}`
      const displayName = entry.userDisplayName?.trim() || fallbackName
      const base =
        existing ?? {
          uid: entry.uid,
          displayName,
          photoURL: entry.userPhotoURL ?? null,
          totalQuantity: 0,
          entries: [],
          runningTotal: 0
        }

      base.displayName = entry.userDisplayName?.trim() || base.displayName
      base.photoURL = entry.userPhotoURL ?? base.photoURL ?? null
      base.entries = [...base.entries, entry]
      base.totalQuantity += entry.quantity
      base.runningTotal += entry.quantity

      if (!base.completedAtTimestamp && challenge?.targetQuantity) {
        if (base.runningTotal >= challenge.targetQuantity) {
          base.completedAtTimestamp = entry.updatedAt?.toMillis() ?? new Date(`${entry.date}T00:00:00`).getTime()
          base.completedOnDate = entry.date
        }
      }

      map.set(entry.uid, base)
    }

    const result = Array.from(map.values()).map((value) => {
      const { runningTotal, ...rest } = value
      return rest
    })

    return result.sort((a, b) => {
      if (b.totalQuantity !== a.totalQuantity) {
        return b.totalQuantity - a.totalQuantity
      }

      if (a.completedAtTimestamp && b.completedAtTimestamp) {
        return a.completedAtTimestamp - b.completedAtTimestamp
      }

      if (a.completedAtTimestamp) return -1
      if (b.completedAtTimestamp) return 1
      return a.displayName.localeCompare(b.displayName)
    })
  }, [challenge?.targetQuantity, entries, user])

  const groupTotal = useMemo(
    () => entries.reduce((total, entry) => total + entry.quantity, 0),
    [entries]
  )

  const completionPercentage = useMemo(() => {
    if (!challenge?.targetQuantity) return 0
    return Math.min(100, Math.round((groupTotal / challenge.targetQuantity) * 100))
  }, [challenge?.targetQuantity, groupTotal])

  const firstFinisher = useMemo(() => {
    const finishers = leaderboard
      .filter((entry) => entry.completedAtTimestamp)
      .sort((a, b) => (a.completedAtTimestamp ?? Infinity) - (b.completedAtTimestamp ?? Infinity))
    return finishers[0] ?? null
  }, [leaderboard])

  const handleGroupChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const nextGroup = normalizeGroupId(String(formData.get('groupId') ?? ''))
    setGroupId(nextGroup)
  }

  const handleProgressSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    setProgressError(null)
    setSavingProgress(true)
    try {
      await saveProgressEntry({
        groupId,
        uid: user.uid,
        date: progressForm.date,
        quantity: Number(progressForm.quantity),
        notes: progressForm.notes,
        userDisplayName: user.displayName ?? user.email ?? 'Anonymous',
        userPhotoURL: user.photoURL ?? null
      })
      setProgressForm((current) => ({ ...current, notes: '' }))
    } catch (error) {
      console.error('Failed to save progress entry', error)
      setProgressError('We could not save your progress. Please try again.')
    }
    setSavingProgress(false)
  }

  const handleChallengeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChallengeError(null)
    setSavingChallenge(true)
    try {
      await upsertChallenge(groupId, challengeForm)
    } catch (error) {
      console.error('Failed to save challenge', error)
      setChallengeError('We were unable to save the challenge details.')
    }
    setSavingChallenge(false)
  }

  const handleResetChallenge = async () => {
    setChallengeError(null)
    setSavingChallenge(true)
    try {
      await resetChallenge(groupId)
    } catch (error) {
      console.error('Failed to reset challenge', error)
      setChallengeError('Resetting the challenge failed. Please try again.')
    }
    setSavingChallenge(false)
  }

  return (
    <section className="space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Team challenge dashboard</h1>
        <p className="mt-2 text-slate-300">
          Track daily progress, log your wins, and cheer on your group as you race toward the shared goal.
        </p>

        <form onSubmit={handleGroupChange} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-200">
            Group ID
            <input
              type="text"
              name="groupId"
              defaultValue={groupId}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white focus:border-sky-500 focus:outline-none"
              placeholder="default"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg border border-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/10"
          >
            Switch group
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <ChallengeStatus
            challenge={challenge}
            loading={loadingChallenge}
            error={challengeError}
            completionPercentage={completionPercentage}
            groupTotal={groupTotal}
            firstFinisher={firstFinisher}
            onReset={handleResetChallenge}
            saving={savingChallenge}
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold text-white">Log today&apos;s effort</h2>
            <p className="mt-1 text-sm text-slate-400">
              Record your contribution for the day and keep the streak going.
            </p>
            {progressError ? (
              <p className="mt-3 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {progressError}
              </p>
            ) : null}
            <form onSubmit={handleProgressSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Date
                <input
                  type="date"
                  name="date"
                  value={progressForm.date}
                  onChange={(event) =>
                    setProgressForm((current) => ({ ...current, date: event.target.value }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Quantity
                <input
                  type="number"
                  name="quantity"
                  min={0}
                  step={1}
                  value={progressForm.quantity}
                  onChange={(event) =>
                    setProgressForm((current) => {
                      const parsed = Number(event.target.value)
                      return { ...current, quantity: Number.isNaN(parsed) ? 0 : parsed }
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  required
                />
              </label>
              <label className="sm:col-span-2 flex flex-col gap-2 text-sm font-medium text-slate-200">
                Notes (optional)
                <textarea
                  name="notes"
                  value={progressForm.notes}
                  onChange={(event) =>
                    setProgressForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={3}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  placeholder="How did it go today?"
                />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProgress || !user}
                  className="inline-flex items-center justify-center rounded-lg border border-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingProgress ? 'Saving…' : 'Save progress'}
                </button>
              </div>
            </form>
          </div>

          <HistoryPanel entries={personalEntries} loading={loadingEntries} />
        </div>

        <div className="space-y-6">
          <LeaderboardPanel
            leaderboard={leaderboard}
            loading={loadingEntries}
            target={challenge?.targetQuantity ?? null}
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold text-white">Challenge setup</h2>
            <p className="mt-1 text-sm text-slate-400">
              Update the team goal, adjust dates, or launch a brand-new challenge.
            </p>
            {challengeError ? (
              <p className="mt-3 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {challengeError}
              </p>
            ) : null}
            <form onSubmit={handleChallengeSubmit} className="mt-4 space-y-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Challenge name
                <input
                  type="text"
                  value={challengeForm.title}
                  onChange={(event) =>
                    setChallengeForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Target quantity
                <input
                  type="number"
                  min={1}
                  value={challengeForm.targetQuantity}
                  onChange={(event) =>
                    setChallengeForm((current) => {
                      const parsed = Number(event.target.value)
                      return { ...current, targetQuantity: Number.isNaN(parsed) ? 1 : parsed }
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Goal description
                <textarea
                  value={challengeForm.goalDescription}
                  onChange={(event) =>
                    setChallengeForm((current) => ({ ...current, goalDescription: event.target.value }))
                  }
                  rows={3}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  placeholder="What are you trying to accomplish together?"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                  Start date
                  <input
                    type="date"
                    value={challengeForm.startDate}
                    onChange={(event) =>
                      setChallengeForm((current) => ({ ...current, startDate: event.target.value }))
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                  End date (optional)
                  <input
                    type="date"
                    value={challengeForm.endDate ?? ''}
                    onChange={(event) =>
                      setChallengeForm((current) => ({ ...current, endDate: event.target.value }))
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingChallenge}
                  className="inline-flex items-center justify-center rounded-lg border border-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingChallenge ? 'Saving…' : challenge ? 'Update challenge' : 'Create challenge'}
                </button>
                <button
                  type="button"
                  disabled={savingChallenge || !challenge}
                  onClick={handleResetChallenge}
                  className="inline-flex items-center justify-center rounded-lg border border-amber-400/70 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingChallenge ? 'Resetting…' : 'Reset challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

function ChallengeStatus({
  challenge,
  loading,
  error,
  completionPercentage,
  groupTotal,
  firstFinisher,
  onReset,
  saving
}: {
  challenge: Challenge | null
  loading: boolean
  error: string | null
  completionPercentage: number
  groupTotal: number
  firstFinisher: ProgressLeaderboardEntry | null
  onReset: () => void
  saving: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {challenge ? challenge.title : 'No challenge yet'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {challenge?.goalDescription
              ? challenge.goalDescription
              : 'Set a team target to begin tracking progress together.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={saving || !challenge}
          className="hidden rounded-lg border border-amber-400/70 px-3 py-1 text-sm font-medium text-amber-200 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
        >
          {saving ? 'Resetting…' : 'Reset'}
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading challenge details…</p>
      ) : error ? (
        <p className="mt-4 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : challenge ? (
        <div className="mt-6 space-y-4">
          <div>
            <dl className="grid grid-cols-2 gap-3 text-sm text-slate-300 sm:grid-cols-4">
              <div>
                <dt className="text-slate-400">Target</dt>
                <dd className="text-lg font-semibold text-white">{challenge.targetQuantity}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Group total</dt>
                <dd className="text-lg font-semibold text-white">{groupTotal}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Start date</dt>
                <dd className="text-lg font-semibold text-white">{challenge.startDate}</dd>
              </div>
              {challenge.endDate ? (
                <div>
                  <dt className="text-slate-400">End date</dt>
                  <dd className="text-lg font-semibold text-white">{challenge.endDate}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{completionPercentage}% of the goal completed.</p>
          </div>
          {firstFinisher ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              🎉 {firstFinisher.displayName} reached the goal first on {firstFinisher.completedOnDate}!
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          Create a new challenge to start tracking your team&apos;s progress.
        </p>
      )}
    </div>
  )
}

function HistoryPanel({ entries, loading }: { entries: ProgressEntry[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-xl font-semibold text-white">Your recent history</h2>
      <p className="mt-1 text-sm text-slate-400">
        Review past submissions, make adjustments, or add context with notes.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading history…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No entries yet. Log your first update to get started!</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
            >
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>{entry.date}</span>
                <span>{entry.quantity}</span>
              </div>
              {entry.notes ? (
                <p className="mt-2 text-sm text-slate-300">{entry.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LeaderboardPanel({
  leaderboard,
  loading,
  target
}: {
  leaderboard: ProgressLeaderboardEntry[]
  loading: boolean
  target: number | null
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-xl font-semibold text-white">Leaderboard</h2>
      <p className="mt-1 text-sm text-slate-400">
        See how the group is progressing toward the shared challenge.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading leaderboard…</p>
      ) : leaderboard.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No activity yet. Start logging entries to see the rankings.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {leaderboard.map((entry, index) => {
            const hasCompleted = target ? entry.totalQuantity >= target : false
            return (
              <li
                key={entry.uid}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-200">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{entry.displayName}</p>
                    <p className="text-xs text-slate-400">
                      {entry.totalQuantity} logged
                      {hasCompleted && entry.completedOnDate
                        ? ` • Finished on ${entry.completedOnDate}`
                        : ''}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
