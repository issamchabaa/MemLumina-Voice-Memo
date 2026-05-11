const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'sheep-db1'
});

async function listMemos() {
  const db = admin.firestore();
  const userId = 'ph3GMP4pBsfrNCVe51F86XZQI1C3';
  const collectionPath = `users/${userId}/voice_memos`;
  
  console.log(`Scanning collection: ${collectionPath}`);
  
  const snapshot = await db.collection(collectionPath).get();
  
  if (snapshot.empty) {
    console.log('No memos found.');
    return;
  }

  console.log(`Found ${snapshot.size} memos.\n`);

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`--- Memo ID: ${doc.id} ---`);
    console.log(`Status: ${data.status}`);
    console.log(`Created At: ${data.createdAt?.toDate().toISOString() || 'N/A'}`);
    console.log(`Transcript: ${data.transcriptText || '[EMPTY]'}`);
    if (data.rawTranscriptText && data.rawTranscriptText !== data.transcriptText) {
      console.log(`Raw Transcript: ${data.rawTranscriptText}`);
    }
    console.log('\n');
  });
}

listMemos();
