import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
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

type Goal = {
  id: string
  groupId: string
  challengeType: string
  targetValue: number
  createdAt?: Timestamp
}

export default function GroupDetails() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [membership, setMembership] = useState<Member | null>(null)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [goalChallengeType, setGoalChallengeType] = useState('')
  const [goalTargetValue, setGoalTargetValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalMessage, setGoalMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        return
      }

      const data = snapshot.data()
      const challengeType = (data.challengeType as string) ?? ''
      const targetValue = data.targetValue as number | undefined
      setGoal({
        id: snapshot.id,
        groupId: (data.groupId as string) ?? groupId,
        challengeType,
        targetValue: typeof targetValue === 'number' ? targetValue : 0,
        createdAt: data.createdAt as Timestamp | undefined
      })
      setGoalChallengeType(challengeType)
      setGoalTargetValue(
        typeof targetValue === 'number' && Number.isFinite(targetValue)
          ? String(targetValue)
          : ''
      )
    })

    return () => unsubscribe()
  }, [groupId])

  const isOwner = useMemo(() => membership?.role === 'owner', [membership])

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
      const goalRef = doc(db, 'goals', groupId)
      await setDoc(
        goalRef,
        {
          groupId,
          challengeType: goalChallengeType.trim(),
          targetValue: parsedTargetValue,
          updatedAt: serverTimestamp(),
          createdAt: goal?.createdAt ?? serverTimestamp()
        },
        { merge: true }
      )
      setGoalMessage('Goal updated!')
    } catch (saveError) {
      console.error(saveError)
      setGoalMessage('Unable to save goal right now.')
    } finally {
      setSavingGoal(false)
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
              Target: <span className="font-medium text-white">{goal.targetValue}</span>
            </p>
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
          </form>
        ) : null}
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
