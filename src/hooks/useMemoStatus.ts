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
  captureMode?: string;
  audioRetainedUntil?: any;
}

export const useMemoStatus = (memoId: string | null) => {
  const [memoData, setMemoData] = useState<MemoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!memoId) {
      setMemoData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, `users/${auth.currentUser?.uid}/voice_memos`, memoId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MemoStatus;
        setMemoData(data);
      } else {
        console.warn(`Memo with ID ${memoId} not found.`);
        setMemoData(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error listening to memo status:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [memoId]);

  return { memoData, isLoading };
};
