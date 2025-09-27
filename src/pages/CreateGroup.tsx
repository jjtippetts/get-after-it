import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, serverTimestamp, setDoc, doc } from 'firebase/firestore'

import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'

function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length)
    code += alphabet[randomIndex]
  }
  return code
}

export default function CreateGroup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('A group name is required.')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const inviteCode = generateInviteCode()
      const groupData = {
        name: name.trim(),
        nameLowercase: name.trim().toLowerCase(),
        description: description.trim() || null,
        ownerId: user.uid,
        inviteCode,
        createdAt: serverTimestamp()
      }
      const groupRef = await addDoc(collection(db, 'groups'), groupData)

      const membershipRef = doc(db, 'groupMembers', `${groupRef.id}_${user.uid}`)
      await setDoc(membershipRef, {
        groupId: groupRef.id,
        userId: user.uid,
        role: 'owner',
        joinedAt: serverTimestamp(),
        displayName: user.displayName ?? user.email ?? 'Owner',
        photoURL: user.photoURL ?? null
      })

      navigate(`/groups/${groupRef.id}`)
    } catch (createError) {
      console.error(createError)
      setError('Unable to create group right now. Please try again later.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold text-white">Create a group</h1>
      <p className="mt-2 text-sm text-slate-400">
        Set up a new accountability group and invite friends to join your challenge.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <label htmlFor="group-name" className="text-sm font-medium text-slate-200">
            Group name
          </label>
          <input
            id="group-name"
            name="group-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Morning Hustlers"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="group-description" className="text-sm font-medium text-slate-200">
            Description
          </label>
          <textarea
            id="group-description"
            name="group-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe your challenge or group goals"
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create group'}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      </form>
    </div>
  )
}
