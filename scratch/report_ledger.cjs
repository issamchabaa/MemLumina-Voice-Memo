const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'sheep-db1'
});

async function reportLatestLedger() {
  const db = admin.firestore();
  const userId = 'ph3GMP4pBsfrNCVe51F86XZQI1C3';
  const collectionPath = `users/${userId}/voice_memos`;
  
  console.log(`Inspecting latest entries in: ${collectionPath}\n`);
  
  // Get latest 5 memos by creation time
  const snapshot = await db.collection(collectionPath)
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  
  if (snapshot.empty) {
    console.log('No ledger entries found.');
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`[ID: ${doc.id}]`);
    console.log(`- Created: ${data.createdAt?.toDate().toLocaleString() || 'N/A'}`);
    console.log(`- Status:  ${data.status}`);
    console.log(`- Provider: ${data.transcriptProvider || 'N/A'}`);
    console.log(`- Content: "${data.transcriptText || '[Empty]'}"`);
    console.log('--------------------------------------------------');
  });
}

reportLatestLedger();
