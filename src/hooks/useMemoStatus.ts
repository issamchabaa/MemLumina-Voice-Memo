import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

export interface MemoStatus {
  status: 'local-only' | 'uploading' | 'recorded' | 'transcribing' | 'transcribed' | 'error' | 'submitted' | 'processed';
  transcriptText?: string;
  rawTranscriptText?: string;
  transcriptProvider?: string;
  transcriptModel?: string;
  transcriptLanguage?: string;
  transcriptConfidence?: number | null;
  rawTurnId?: string;
  clerkJobId?: string;
  submittedAt?: any;
  errorDetails?: string;
  audioRetainedUntil?: any;
}

export const useMemoStatus = (memoId: string | null) => {
  const [state, setState] = useState<{ id: string | null, data: MemoStatus | null }>({ id: null, data: null });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!memoId) {
      setState({ id: null, data: null });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setState({ id: memoId, data: null }); // Clear previous memo data to prevent stale state bleed
    const docRef = doc(db, `users/${auth.currentUser?.uid}/voice_memos`, memoId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MemoStatus;
        setState({ id: memoId, data });
      } else {
        console.warn(`Memo with ID ${memoId} not found.`);
        setState({ id: memoId, data: null });
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error listening to memo status:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [memoId]);

  // Prevent returning stale data for a different memoId
  const memoData = state.id === memoId ? state.data : null;

  return { memoData, isLoading };
};
