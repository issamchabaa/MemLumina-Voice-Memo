import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import { ClerkJob, RawTurn } from './types';

admin.initializeApp();
 


// V2 client
// STT logic integrated below

/**
 * Triggered when a new voice memo is uploaded to Firebase Storage.
 * It uses Google Speech-to-Text V2 (Chirp 2) to transcribe the audio and updates Firestore.
 */
export const onMemoUploaded = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  
  if (!filePath) return null;

  // Only process files in the memos directory with supported extensions
  const supportedExtensions = ['.webm', '.mp4', '.aiff', '.wav', '.m4a', '.ogg', '.flac'];
  const hasSupportedExtension = supportedExtensions.some(ext => filePath.toLowerCase().endsWith(ext));

  const normalizedPath = filePath.toLowerCase().trim();
  const isUploads = normalizedPath.startsWith('uploads/');
  const isMemos = normalizedPath.includes('/memos/');
  
  if (!isUploads || !isMemos || !hasSupportedExtension) {
    console.log(`Skipping file. Original: "${filePath}", Normalized: "${normalizedPath}", isUploads: ${isUploads}, isMemos: ${isMemos}, hasSupportedExtension: ${hasSupportedExtension}`);
    return null;
  }

  const parts = filePath.split('/');
  const userId = parts[1];
  const fileName = parts[parts.length - 1];
  const memoId = fileName.split('.')[0];
  const gcsUri = `gs://${object.bucket}/${filePath}`;

  const ext = filePath.split('.').pop()?.toLowerCase();
  let mimeType = 'audio/webm';
  if (ext === 'mp4') mimeType = 'audio/mp4';
  if (ext === 'm4a') mimeType = 'audio/m4a';
  if (ext === 'wav') mimeType = 'audio/wav';
  if (ext === 'ogg') mimeType = 'audio/ogg';
  if (ext === 'flac') mimeType = 'audio/flac';
  if (ext === 'aiff') mimeType = 'audio/aiff';

  try {
    const docRef = admin.firestore().collection(`users/${userId}/voice_memos`).doc(memoId);
    
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.warn(`Firestore document for memo ${memoId} not found yet. Retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const retrySnap = await docRef.get();
      if (!retrySnap.exists) {
        console.error(`Firestore document for memo ${memoId} still not found.`);
        return null;
      }
    }

    await docRef.update({
      status: 'transcribing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Starting Gemini Multimodal transcription for: ${gcsUri}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    console.log(`Downloading audio file to buffer for Gemini processing...`);
    const [fileBuffer] = await admin.storage().bucket(object.bucket).file(filePath).download();
    const base64Data = fileBuffer.toString('base64');

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        },
        {
          text: `You are an expert cognitive assistant. Your task is to accurately transcribe this voice memo into a high-quality cognitive memo. 
The speaker may be speaking in English or French, or both. Maintain the original language of the speaker. Do not force phonetic interpretations from the wrong language.

Follow these rules:
1. TRANSCRIBE: Accurately transcribe the audio. Do NOT translate it to another language.
2. FIX errors: Correct typos and grammatical slips, but keep the original meaning.
3. REMOVE noise: Strip filler words (ums, ahs, like, you know, euh, alors), false starts, and redundant repetitions.
4. STRUCTURE: Use clear headings if the content is long. Use bullet points for lists of items or instructions.
5. FORMAT: Return only the final transcribed and cleaned text in the original language. Do not include any conversational filler from yourself.`
        }
      ]
    });
    
    const cleanTranscriptText = aiResponse.text || '';
    console.log('Gemini multimodal transcription successful:', cleanTranscriptText);

    const transcriptProvider = 'gemini-2.5-flash';
    const transcriptModel = 'gemini-2.5-flash';
    const transcriptLanguage = 'auto';

    await docRef.update({
      status: 'transcribed',
      transcriptText: cleanTranscriptText,
      rawTranscriptText: cleanTranscriptText, 
      transcriptProvider,
      transcriptModel,
      transcriptLanguage,
      transcriptConfidence: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  } catch (error) {
    console.error('STT V2 Transcription process failed:', error);
    
    try {
      const docRef = admin.firestore().collection(`users/${userId}/voice_memos`).doc(memoId);
      await docRef.update({
        status: 'error',
        errorDetails: (error as Error).message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (dbError) {
      console.error('Failed to update error status in Firestore:', dbError);
    }
  }

  return null;
});

/**
 * Callable function for the client to explicitly submit a transcribed memo
 * to the Cognitive Ledger System (CLS).
 */
export const submitMemoToLedger = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { memoId, reviewedByUser, source = 'MemLumina-Voice-Capture', submittedFrom = 'web', capturedAt, editedTranscriptText } = data;
  if (!memoId) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a memoId.');
  }

  const db = admin.firestore();
  const memoRef = db.collection(`users/${context.auth.uid}/voice_memos`).doc(memoId);
  const memoSnap = await memoRef.get();

  if (!memoSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Voice memo document not found.');
  }

  const memo = memoSnap.data();
  if (memo?.userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'You do not have permission to submit this memo.');
  }

  if (memo?.status !== 'transcribed') {
    throw new functions.https.HttpsError('failed-precondition', `Memo must be in 'transcribed' state to submit. Current state: ${memo?.status}`);
  }

  const rawTurnId = `voice-${memoId}`;
  const finalTranscriptText = editedTranscriptText || memo.transcriptText || '';

  const transcriptProvider = memo.transcriptProvider || 'google_speech_to_text_v2';
  const transcriptModel = memo.transcriptModel || 'chirp-2';
  const transcriptLanguage = memo.transcriptLanguage || 'en-US';
  const transcriptConfidence = memo.transcriptConfidence ?? null;
  const submittedAt = new Date().toISOString();
  const memoCreatedAt = memo.createdAt && typeof memo.createdAt === 'object' && 'toDate' in memo.createdAt
    ? memo.createdAt.toDate().toISOString()
    : String(memo.createdAt || new Date().toISOString());
  const capturedAtValue = capturedAt || memoCreatedAt;

  const contentHash = createHash('sha256')
    .update(`${memoId}:${finalTranscriptText}:${capturedAtValue}:${submittedAt}`)
    .digest('hex');

  const rawTurn: RawTurn = {
    id: rawTurnId,
    userId: context.auth.uid,
    ledgerStreamId: 'voice_memos',
    conversationId: `voice-memo-${memoId}`,
    turnId: `turn-1`,
    sequenceNumber: 1,
    messages: [
      {
        role: 'system',
        content: `SYSTEM: VOICE CAPTURE protocol active. This input is a transcribed voice memo. Extract entities and update cognitive ledger appropriately.`,
      },
      {
        role: 'user',
        content: finalTranscriptText,
      }
    ],
    toolCalls: [],
    attachments: [
      {
        type: 'audio',
        uri: memo.storagePath || '',
      }
    ],
    contentHash,
    previousHash: null,
    createdAt: submittedAt,
    sealed: true,
    schemaVersion: 1,
    metadata: {
      source,
      memoId,
      audioStoragePath: memo.storagePath || '',
      transcriptText: finalTranscriptText,
      transcriptProvider,
      transcriptModel,
      transcriptLanguage,
      transcriptConfidence,
      submittedFrom,
      reviewedByUser: reviewedByUser === true,
      capturedAt: capturedAtValue,
      submittedAt,
    }
  };

  const clerkJob: ClerkJob = {
    id: `clerk-${memoId}`,
    userId: context.auth.uid,
    rawTurnId: rawTurnId,
    status: 'PENDING',
    createdAt: submittedAt,
    updatedAt: submittedAt,
  };

  try {
    const rawTurnRef = db.collection(`users/${context.auth.uid}/cls/root/raw_turns`).doc(rawTurnId);
    
    // Explicit idempotency check
    const rawTurnSnap = await rawTurnRef.get();
    if (rawTurnSnap.exists) {
      console.log(`Memo ${memoId} was already submitted. Idempotent return.`);
      return { 
        success: true, 
        rawTurnId, 
        clerkJobId: clerkJob.id,
        idempotent: true
      };
    }

    const batch = db.batch();
    
    // Use create to ensure we don't overwrite if it somehow was created concurrently
    batch.create(rawTurnRef, rawTurn);
    batch.create(db.collection(`users/${context.auth.uid}/cls/root/clerk_jobs`).doc(clerkJob.id), clerkJob);
    
    const memoUpdateData: any = {
      status: 'submitted',
      rawTurnId: rawTurnId,
      clerkJobId: clerkJob.id,
      transcriptProvider,
      transcriptModel,
      transcriptLanguage,
      transcriptConfidence,
      submittedAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (editedTranscriptText) {
      memoUpdateData.transcriptText = editedTranscriptText;
    }
    batch.update(memoRef, memoUpdateData);

    await batch.commit();
    console.log(`Memo ${memoId} successfully submitted to CLS. RawTurn: ${rawTurnId}`);

    return { 
      success: true, 
      rawTurnId, 
      clerkJobId: clerkJob.id 
    };
  } catch (error: any) {
    if (error.code === 6) { // ALREADY_EXISTS grpc status code
      console.log(`Memo ${memoId} was submitted concurrently. Idempotent return.`);
      return { 
        success: true, 
        rawTurnId, 
        clerkJobId: clerkJob.id,
        idempotent: true
      };
    }
    console.error('Failed to submit memo to ledger:', error);
    throw new functions.https.HttpsError('internal', 'Internal error during ledger submission.');
  }
});

/**
 * Triggered when a ClerkJob is updated.
 * If the job status is DONE, find the associated memo and update its status to 'processed'.
 */
export const onClerkJobUpdated = functions.firestore.document('users/{userId}/cls/root/clerk_jobs/{jobId}').onUpdate(async (change, context) => {
  const newValue = change.after.data() as ClerkJob;
  const previousValue = change.before.data() as ClerkJob;

  if (newValue.status === 'DONE' && previousValue.status !== 'DONE') {
    const rawTurnId = newValue.rawTurnId;
    if (rawTurnId && rawTurnId.startsWith('voice-')) {
      const memoId = rawTurnId.replace('voice-', '');
      const db = admin.firestore();
      
      console.log(`ClerkJob ${context.params.jobId} completed. Updating memo ${memoId} to 'processed'`);
      
      try {
        const memoRef = db.collection(`users/${newValue.userId}/voice_memos`).doc(memoId);
        await memoRef.get();
        
          await memoRef.update({
            status: 'processed',
            rawTurnId: newValue.rawTurnId,
            clerkJobId: context.params.jobId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // Retain audio for 14 days to allow quality verification and reprocessing
            audioRetainedUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          });

          console.log(`Memo ${memoId} marked as processed. RawTurn: ${newValue.rawTurnId}, ClerkJob: ${context.params.jobId}. Audio retained until ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()}.`);
      } catch (error) {
        console.error(`Failed to update memo ${memoId} status to 'processed':`, error);
      }
    }
  }
});
