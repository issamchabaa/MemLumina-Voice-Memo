import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { v2 } from '@google-cloud/speech';
import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import { ClerkJob, RawTurn } from './types';

admin.initializeApp();

// V2 client
const speechClient = new v2.SpeechClient();

/**
 * Triggered when a new voice memo is uploaded to Firebase Storage.
 * It uses Google Speech-to-Text V2 (Chirp 2) to transcribe the audio and updates Firestore.
 */
export const onMemoUploaded = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  
  // Only process files in the memos directory with supported extensions
  if (!filePath?.startsWith('uploads/') || !filePath.includes('/memos/') || (!filePath.endsWith('.webm') && !filePath.endsWith('.mp4'))) {
    console.log('Skipping non-memo file:', filePath);
    return null;
  }

  const parts = filePath.split('/');
  const userId = parts[1];
  const fileName = parts[parts.length - 1];
  const memoId = fileName.split('.')[0];

  console.log(`Processing memo ${memoId} for user ${userId} using STT V2 (Chirp 2)`);

  const gcsUri = `gs://${object.bucket}/${filePath}`;
  
  // V2 requires a project and location for the recognizer
  const projectId = admin.instanceId().app.options.projectId || process.env.GCLOUD_PROJECT;
  const location = 'us-central1'; // Chirp 2 is widely available here
  
  const parent = `projects/${projectId}/locations/${location}`;
  
  const recognitionConfig = {
    autoDecodingConfig: {}, 
    model: 'chirp-2',
    languageCodes: ['en-US'],
    features: {
      enableAutomaticPunctuation: true,
    },
  };

  const request = {
    recognizer: `${parent}/recognizers/_`, 
    config: recognitionConfig,
    uri: gcsUri,
  };

  try {
    const docRef = admin.firestore().collection('voice_memos').doc(memoId);
    
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

    console.log('Starting V2 transcription for:', gcsUri);
    const [response] = await speechClient.recognize(request);
    
    const transcript = response.results
      ?.map(result => result.alternatives?.[0].transcript)
      .join('\n');

    const transcriptConfidences = response.results
      ?.map(result => result.alternatives?.[0].confidence)
      .filter((value): value is number => typeof value === 'number');

    const transcriptConfidence = transcriptConfidences && transcriptConfidences.length > 0
      ? transcriptConfidences.reduce((sum, value) => sum + value, 0) / transcriptConfidences.length
      : null;

    const transcriptProvider = 'google_speech_to_text_v2';
    const transcriptModel = 'chirp-2';
    const transcriptLanguage = 'en-US';

    console.log('V2 Transcription successful:', transcript);

    let cleanTranscriptText = transcript || '';
    if (transcript) {
      try {
        const ai = new GoogleGenAI({ project: projectId, location: 'us-central1', vertexai: true });
        const aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Please clean up the following raw voice transcription, fixing any grammatical errors, removing filler words (ums, ahs), and formatting it into a clear, concise memo. Keep the original meaning and tone intact.

Raw Transcript:
${transcript}`
        });
        cleanTranscriptText = aiResponse.text || transcript;
        console.log('Gemini cleanup successful');
      } catch (aiError) {
        console.error('Gemini cleanup failed, falling back to raw transcript:', aiError);
      }
    }

    await docRef.update({
      status: 'transcribed',
      transcriptText: cleanTranscriptText,
      rawTranscriptText: transcript || '', // Keep raw for observability/correction
      transcriptProvider,
      transcriptModel,
      transcriptLanguage,
      transcriptConfidence,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  } catch (error) {
    console.error('STT V2 Transcription process failed:', error);
    
    try {
      const docRef = admin.firestore().collection('voice_memos').doc(memoId);
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

  const { memoId, captureMode, reviewedByUser, source = 'MemLumina-Voice-Capture', submittedFrom = 'web', capturedAt, editedTranscriptText } = data;
  if (!memoId) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a memoId.');
  }

  const db = admin.firestore();
  const memoRef = db.collection('voice_memos').doc(memoId);
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
  const captureModeValue = captureMode || memo.captureMode || memo.mode || 'idea';

  const contentHash = createHash('sha256')
    .update(`${memoId}:${finalTranscriptText}:${captureModeValue}:${capturedAtValue}:${submittedAt}`)
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
      captureMode: captureModeValue,
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
    const rawTurnRef = db.collection('raw_turns').doc(rawTurnId);
    
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
    batch.create(db.collection('clerk_jobs').doc(clerkJob.id), clerkJob);
    
    const memoUpdateData: any = {
      status: 'submitted',
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
export const onClerkJobUpdated = functions.firestore.document('clerk_jobs/{jobId}').onUpdate(async (change, context) => {
  const newValue = change.after.data() as ClerkJob;
  const previousValue = change.before.data() as ClerkJob;

  if (newValue.status === 'DONE' && previousValue.status !== 'DONE') {
    const rawTurnId = newValue.rawTurnId;
    if (rawTurnId && rawTurnId.startsWith('voice-')) {
      const memoId = rawTurnId.replace('voice-', '');
      const db = admin.firestore();
      
      console.log(`ClerkJob ${context.params.jobId} completed. Updating memo ${memoId} to 'processed'`);
      
      try {
        const memoRef = db.collection('voice_memos').doc(memoId);
        const memoSnap = await memoRef.get();
        
        await memoRef.update({
          status: 'processed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Retention policy: Clean up raw audio once successfully processed by CLS
        if (memoSnap.exists) {
          const memoData = memoSnap.data();
          if (memoData?.storagePath) {
            try {
              const bucket = admin.storage().bucket(); // gets default bucket
              await bucket.file(memoData.storagePath).delete();
              console.log(`Successfully cleaned up raw audio: ${memoData.storagePath}`);
              
              // Also remove it from firestore doc to reflect it's gone
              await memoRef.update({
                audioURL: admin.firestore.FieldValue.delete(),
                storagePath: admin.firestore.FieldValue.delete(),
              });
            } catch (storageError) {
              console.error(`Failed to delete raw audio ${memoData.storagePath}:`, storageError);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to update memo ${memoId} status to 'processed':`, error);
      }
    }
  }
});
