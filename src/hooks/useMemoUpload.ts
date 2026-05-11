import { useState, useCallback, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db, auth } from '../firebase';
import { set, get, keys, del } from 'idb-keyval';

export const useMemoUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performUpload = async (userId: string, memoId: string, blob: Blob, captureMode: string) => {
    // 1. Create/Update Firestore document reference
    const voiceMemosRef = collection(db, `users/${userId}/voice_memos`);
    const memoDocRef = doc(voiceMemosRef, memoId);

    // Initial record creation
    await setDoc(memoDocRef, {
      userId,
      memoId, // Canonical ID matching doc ID
      status: 'uploading',
      captureMode,
      audioContentType: blob.type,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Upload to Storage using the canonical memoId
    const fileExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const storagePath = `uploads/${userId}/memos/${memoId}.${fileExtension}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    // 3. Update Firestore record with final details and status 'recorded'
    await updateDoc(memoDocRef, {
      audioURL: downloadURL,
      storagePath,
      status: 'recorded',
      updatedAt: serverTimestamp(),
    });
  };

  const syncOfflineMemos = useCallback(async () => {
    if (!navigator.onLine) return;
    
    const allKeys = await keys();
    const memoKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('offline-memo-'));
    
    for (const key of memoKeys) {
      const data = await get(key);
      if (data && data.userId && data.memoId && data.blob && data.captureMode) {
        try {
          await performUpload(data.userId, data.memoId, data.blob, data.captureMode);
          await del(key); // clear after successful upload
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

    if (!navigator.onLine) {
      // Offline: store to IDB
      try {
        await set(`offline-memo-${memoId}`, {
          userId: user.uid,
          memoId,
          blob,
          captureMode,
          timestamp: Date.now()
        });
        setIsUploading(false);
        // We return memoId to UI so it can reflect "saved offline" state
        return memoId;
      } catch (err: any) {
        console.error('Failed to save memo offline', err);
        setError('Failed to save memo offline');
        setIsUploading(false);
        return null;
      }
    }

    try {
      await performUpload(user.uid, memoId, blob, captureMode);
      setIsUploading(false);
      return memoId;
    } catch (err: any) {
      console.error('Upload failed', err);
      
      // If it failed due to network, try saving offline as fallback
      try {
         await set(`offline-memo-${memoId}`, {
          userId: user.uid,
          memoId,
          blob,
          captureMode,
          timestamp: Date.now()
        });
        setIsUploading(false);
        return memoId;
      } catch (idbErr) {
        setError(err.message || 'Upload failed');
        setIsUploading(false);
        return null;
      }
    }
  }, []);

  return { uploadMemo, isUploading, error, syncOfflineMemos };
};
