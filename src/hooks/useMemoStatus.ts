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
    const user = auth.currentUser;
    if (!user || !memoId) {
      setState({ id: null, data: null });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setState({ id: memoId, data: null }); // Clear previous memo data to prevent stale state bleed
    const docRef = doc(db, `users/${user.uid}/voice_memos`, memoId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MemoStatus;
        // Verify this update is for the current memoId to handle race conditions
        setState(prev => prev.id === memoId ? { id: memoId, data } : prev);
      } else {
        console.warn(`Memo with ID ${memoId} not found.`);
        setState(prev => prev.id === memoId ? { id: memoId, data: null } : prev);
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error listening to memo status:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [memoId, auth.currentUser?.uid]); // Add uid to dependencies

  // Prevent returning stale data for a different memoId
  const memoData = state.id === memoId ? state.data : null;

  return { memoData, isLoading };
};
