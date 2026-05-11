const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'sheep-db1'
});

async function prepareTest() {
  const db = admin.firestore();
  const userId = 'ph3GMP4pBsfrNCVe51F86XZQI1C3';
  const memoId = 'test_simulation_id_v2';
  const docPath = `users/${userId}/voice_memos/${memoId}`;
  
  await db.doc(docPath).set({
    userId,
    status: 'recorded',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    fileName: `${memoId}.mp4`,
    duration: 5,
    title: 'Automated AI Simulation Test V2'
  });
}

prepareTest();
