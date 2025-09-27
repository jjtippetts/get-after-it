import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Timestamp,
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  where
} from 'firebase/firestore'

import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

type Group = {
  id: string
  name: string
  description?: string
  inviteCode: string
  ownerId: string
}

type Membership = {
  id: string
  groupId: string
  role: 'owner' | 'member'
  joinedAt?: Timestamp
}

export default function GroupsList() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [memberships, setMemberships] = useState<Record<string, Membership>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinMessage, setJoinMessage] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Group[]>([])

  useEffect(() => {
    if (!user) {
      return
    }

    const membershipsQuery = query(
      collection(db, 'groupMembers'),
      where('userId', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      membershipsQuery,
      async (snapshot) => {
        const membershipDocs: Membership[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          return {
            id: docSnapshot.id,
            groupId: data.groupId as string,
            role: data.role as 'owner' | 'member',
            joinedAt: data.joinedAt as Timestamp | undefined
          }
        })

        setMemberships(
          membershipDocs.reduce((acc, membershipDoc) => {
            acc[membershipDoc.groupId] = membershipDoc
            return acc
          }, {} as Record<string, Membership>)
        )

        if (!membershipDocs.length) {
          setGroups([])
          setLoading(false)
          return
        }

        try {
          const groupSnapshots = await Promise.all(
            membershipDocs.map((membershipDoc) =>
              getDoc(doc(db, 'groups', membershipDoc.groupId))
            )
          )

          const groupData = groupSnapshots
            .filter((groupSnapshot) => groupSnapshot.exists())
            .map((groupSnapshot) => {
              const data = groupSnapshot.data()
              const descriptionValue = data.description
              return {
                id: groupSnapshot.id,
                name: data.name as string,
                description:
                  typeof descriptionValue === 'string' && descriptionValue.length
                    ? descriptionValue
                    : undefined,
                inviteCode: data.inviteCode as string,
                ownerId: data.ownerId as string
              }
            })

          setGroups(groupData)
        } catch (groupError) {
          console.error(groupError)
          setError('Failed to load groups')
        } finally {
          setLoading(false)
        }
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError('Failed to load memberships')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    let isCurrent = true

    const runSearch = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([])
        setSearching(false)
        return
      }

      setSearching(true)
      setError(null)
      try {
        const normalized = searchTerm.trim().toLowerCase()
        const searchQuery = query(
          collection(db, 'groups'),
          orderBy('nameLowercase'),
          startAt(normalized),
          endAt(`${normalized}\uf8ff`),
          limit(10)
        )
        const snapshot = await getDocs(searchQuery)
        if (!isCurrent) return
        const results: Group[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          const descriptionValue = data.description
          return {
            id: docSnapshot.id,
            name: data.name as string,
            description:
              typeof descriptionValue === 'string' && descriptionValue.length
                ? descriptionValue
                : undefined,
            inviteCode: data.inviteCode as string,
            ownerId: data.ownerId as string
          }
        })
        setSearchResults(results)
      } catch (searchError) {
        console.error(searchError)
        if (isCurrent) {
          setError('Search failed. Try a different term.')
        }
      } finally {
        if (isCurrent) {
          setSearching(false)
        }
      }
    }

    void runSearch()

    return () => {
      isCurrent = false
    }
  }, [searchTerm])

  const handleJoinByCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !inviteCode.trim()) {
      return
    }

    setJoining(true)
    setJoinMessage(null)
    setError(null)

    try {
      const code = inviteCode.trim().toUpperCase()
      const codeQuery = query(
        collection(db, 'groups'),
        where('inviteCode', '==', code),
        limit(1)
      )
      const snapshot = await getDocs(codeQuery)

      if (snapshot.empty) {
        setJoinMessage('No group found with that invite code.')
        return
      }

      const groupDoc = snapshot.docs[0]
      if (memberships[groupDoc.id]) {
        setJoinMessage('You are already a member of that group.')
        return
      }
      await joinGroup(groupDoc.id, groupDoc.data().inviteCode as string)
      setJoinMessage('Joined group successfully!')
      setInviteCode('')
    } catch (joinError) {
      console.error(joinError)
      setError('Unable to join group right now. Please try again later.')
    } finally {
      setJoining(false)
    }
  }

  const joinGroup = async (groupId: string, code: string) => {
    if (!user) return
    if (memberships[groupId]) return

    const membershipRef = doc(db, 'groupMembers', `${groupId}_${user.uid}`)
    await setDoc(
      membershipRef,
      {
        groupId,
        userId: user.uid,
        role: memberships[groupId]?.role ?? 'member',
        joinedAt: memberships[groupId]?.joinedAt ?? serverTimestamp(),
        displayName: user.displayName ?? user.email ?? 'Member',
        photoURL: user.photoURL ?? null,
        inviteCodeUsed: code
      },
      { merge: true }
    )
  }

  const handleSearchJoin = async (group: Group) => {
    try {
      await joinGroup(group.id, group.inviteCode)
      setJoinMessage(`Joined ${group.name}`)
    } catch (joinError) {
      console.error(joinError)
      setError('Unable to join that group right now.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-300">
        <span>Loading your groups…</span>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Your groups</h1>
          <p className="text-sm text-slate-400">
            Join an existing challenge or create a new accountability group.
          </p>
        </div>
        <Link
          to="/groups/new"
          className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
        >
          Create group
        </Link>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {groups.length ? (
          groups.map((group) => (
            <article
              key={group.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{group.name}</h2>
                  {group.description ? (
                    <p className="mt-2 text-sm text-slate-300">{group.description}</p>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                    Invite code: <span className="font-mono text-slate-300">{group.inviteCode}</span>
                  </p>
                </div>
                <Link
                  to={`/groups/${group.id}`}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:text-white"
                >
                  View
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-400">
            <p className="font-medium text-slate-300">No groups yet</p>
            <p className="mt-2 text-sm">
              Create your first group or join one with an invite code.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-white">Join with invite code</h2>
        <p className="mt-2 text-sm text-slate-400">
          Ask a friend for their group&apos;s invite code to hop in instantly.
        </p>
        <form onSubmit={handleJoinByCode} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
          <button
            type="submit"
            disabled={joining}
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {joining ? 'Joining…' : 'Join group'}
          </button>
        </form>
        {joinMessage ? (
          <p className="mt-3 text-sm text-slate-300">{joinMessage}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-white">Find groups</h2>
        <p className="mt-2 text-sm text-slate-400">
          Search for public groups by name and request to join instantly.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search for groups"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
          {searching ? (
            <p className="text-sm text-slate-400">Searching…</p>
          ) : null}
          <div className="space-y-3">
            {searchResults.map((group) => {
              const alreadyMember = Boolean(memberships[group.id])
              return (
                <div
                  key={group.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium text-white">{group.name}</p>
                    {group.description ? (
                      <p className="text-sm text-slate-400">{group.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/groups/${group.id}`}
                      className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-300 transition hover:border-sky-500 hover:text-white"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleSearchJoin(group)}
                      disabled={alreadyMember}
                      className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {alreadyMember ? 'Member' : 'Join'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  )
}
