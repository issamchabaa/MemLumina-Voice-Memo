import { useState, useCallback, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db, auth } from '../firebase';
import { set, get, keys, del } from 'idb-keyval';

export const useMemoUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performUpload = async (userId: string, memoId: string, blob: Blob, captureMode: string) => {
    // 1. Update Firestore document to 'uploading'
    const voiceMemosRef = collection(db, `users/${userId}/voice_memos`);
    const memoDocRef = doc(voiceMemosRef, memoId);

    await setDoc(memoDocRef, {
      status: 'uploading',
      storageState: 'uploading',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // 2. Upload to Storage using the canonical memoId
    const fileExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const storagePath = `uploads/${userId}/memos/${memoId}.${fileExtension}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    // 3. Update Firestore record with final details and status 'recorded'
    await setDoc(memoDocRef, {
      audioURL: downloadURL,
      storagePath,
      storageState: 'stored',
      status: 'recorded', // This triggers transcription pipeline
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const syncOfflineMemos = useCallback(async () => {
    if (!navigator.onLine) return;
    
    const allKeys = await keys();
    const memoKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('offline-memo-'));
    
    for (const key of memoKeys) {
      const data = await get(key);
      if (data && data.userId && data.memoId && data.blob && data.captureMode) {
        try {
          // Check if it's already uploaded in Firestore to avoid redundant uploads
          // (Though performUpload updates it anyway, it's safer)
          await performUpload(data.userId, data.memoId, data.blob, data.captureMode);
          
          // Task 4: Retain until safe handoff. For now, we clear after successful upload 
          // to prevent endless retries, but we could keep it longer if we track ingestion.
          await del(key); 
          console.log(`Successfully synced offline memo: ${data.memoId}`);
        } catch (err) {
          console.error(`Failed to sync offline memo: ${data.memoId}`, err);
        }
      }
    }
  }, []);

  // Listen for online events to trigger sync
  useEffect(() => {
    window.addEventListener('online', syncOfflineMemos);
    return () => window.removeEventListener('online', syncOfflineMemos);
  }, [syncOfflineMemos]);

  const uploadMemo = useCallback(async (blob: Blob, captureMode: string) => {
    const user = auth.currentUser;
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setIsUploading(true);
    setError(null);

    const voiceMemosRef = collection(db, `users/${user.uid}/voice_memos`);
    const memoId = doc(voiceMemosRef).id;
    const memoDocRef = doc(voiceMemosRef, memoId);

    // 1. STAGE 1: Always persist locally first
    try {
      await set(`offline-memo-${memoId}`, {
        userId: user.uid,
        memoId,
        blob,
        captureMode,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Failed to stage audio locally', err);
      setError('Local staging failed');
      setIsUploading(false);
      return null;
    }

    // 2. STAGE 2: Create local-first Firestore record
    try {
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() + 7);

      await setDoc(memoDocRef, {
        userId: user.uid,
        memoId,
        status: 'local-only',
        storageState: 'local',
        audioStaged: true,
        captureMode,
        audioContentType: blob.type,
        audioRetainedUntil: retentionDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to create Firestore record', err);
      // We continue because the audio is at least staged locally in IDB
    }

    // 3. STAGE 3: Attempt upload if online
    if (navigator.onLine) {
      try {
        await performUpload(user.uid, memoId, blob, captureMode);
        // If successful, we can remove from IDB or keep it for Task 4
        await del(`offline-memo-${memoId}`);
      } catch (err) {
        console.error('Initial upload attempt failed', err);
        // Memo remains in 'local-only' / 'local' state in Firestore and is in IDB
      }
    }

    setIsUploading(false);
    return memoId;
  }, []);

  const retryUpload = useCallback(async (memoId: string) => {
    if (!navigator.onLine) {
      setError('System offline. Reconnect to retry upload.');
      return;
    }

    const key = `offline-memo-${memoId}`;
    const data = await get(key);
    if (!data || !data.userId || !data.blob || !data.captureMode) {
      setError('Staged audio not found or corrupted.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      await performUpload(data.userId, memoId, data.blob, data.captureMode);
      await del(key);
      setIsUploading(false);
    } catch (err: any) {
      console.error('Retry upload failed', err);
      setError(err.message || 'Retry upload failed');
      setIsUploading(false);
    }
  }, []);

  return { uploadMemo, retryUpload, isUploading, error, syncOfflineMemos };
};
