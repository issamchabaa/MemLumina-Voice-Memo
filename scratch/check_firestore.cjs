const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'sheep-db1'
});

async function checkDoc() {
  const db = admin.firestore();
  const docPath = 'users/ph3GMP4pBsfrNCVe51F86XZQI1C3/voice_memos/1NRjATsS1bZQGkftdKpK';
  console.log(`Checking doc: ${docPath}`);
  const doc = await db.doc(docPath).get();
  if (doc.exists) {
    console.log('Document data found.');
    const data = doc.data();
    console.log('Status:', data.status);
    console.log('Transcript Snippet:', data.transcriptText ? data.transcriptText.substring(0, 50) + '...' : 'NONE');
    console.log('Provider:', data.transcriptProvider);
  } else {
    console.log('Document not found');
  }
}

checkDoc();
