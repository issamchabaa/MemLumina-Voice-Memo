import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db, auth } from '../firebase'

export interface VoiceMemo {
  id: string
  userId: string
  status: 'local-only' | 'uploading' | 'recorded' | 'transcribing' | 'transcribed' | 'submitted' | 'processed' | 'error'
  storageState?: 'local' | 'uploading' | 'stored'
  audioStaged?: boolean
  transcriptText?: string
  rawTranscriptText?: string
  errorDetails?: string
  createdAt: any
  updatedAt: any
  captureMode?: string
}

export function useMemoHistory(limitCount: number = 20) {
  const [memos, setMemos] = useState<VoiceMemo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const user = auth.currentUser
    if (!user) {
      setMemos([])
      setIsLoading(false)
      return
    }

    const q = query(
      collection(db, `users/${user.uid}/voice_memos`),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memoList: VoiceMemo[] = []
      snapshot.forEach((doc) => {
        memoList.push({ id: doc.id, ...doc.data() } as VoiceMemo)
      })
      setMemos(memoList)
      setIsLoading(false)
    }, (err) => {
      console.error('Failed to fetch memo history:', err)
      setError(err.message)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [limitCount])

  return { memos, isLoading, error }
}
