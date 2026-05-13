const admin = require('firebase-admin');

// We need to initialize without credentials if we run via firebase CLI, or we can use default credentials.
// Let's use application default credentials.
admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || 'sheep-db1'
});

async function run() {
  try {
    const db = admin.firestore();
    const bucketName = 'sheep-db1.firebasestorage.app'; // Default bucket for project
    const bucket = admin.storage().bucket(bucketName);
    
    console.log('Fetching all voice memos...');
    const memosSnap = await db.collectionGroup('voice_memos').get();
    
    let retriggeredCount = 0;

    for (const memoDoc of memosSnap.docs) {
      const memoData = memoDoc.data();
      const parentUser = memoDoc.ref.parent.parent?.id;
      console.log(`Found memo ${memoDoc.id} for user ${parentUser} with status: ${memoData.status}`);
      if (memoData.status !== 'processed' && memoData.status !== 'transcribed' && memoData.status !== 'submitted') {
        console.log(`Memo is eligible to retrigger: ${memoDoc.id}`);
        
        let filePath = '';
        if (memoData.storagePath) {
          const parts = memoData.storagePath.split(bucketName + '/');
          if (parts.length === 2) {
            filePath = parts[1];
          } else if (memoData.storagePath.startsWith('gs://')) {
            // gs://bucket/path
             const noGs = memoData.storagePath.slice(5);
             const slashIdx = noGs.indexOf('/');
             filePath = noGs.slice(slashIdx + 1);
          }
        }
        
        let fileToCopy = null;

        if (filePath) {
           const file = bucket.file(filePath);
           const [exists] = await file.exists();
           if (exists) {
             fileToCopy = file;
           }
        }
        
        if (!fileToCopy) {
           // Fallback: list files
           const [files] = await bucket.getFiles({ prefix: `uploads/${parentUser}/memos/${memoDoc.id}` });
           if (files.length > 0) {
             fileToCopy = files[0];
           }
        }

        if (fileToCopy) {
          console.log(`Retriggering ${fileToCopy.name}`);
          await fileToCopy.copy(fileToCopy);
          retriggeredCount++;
          
          // Set status to transcribing so we know we got it
          await memoDoc.ref.update({ status: 'transcribing' });
        } else {
          console.log(`Could not find audio in Storage for memo ${memoDoc.id}`);
        }
      }
    }
    
    console.log(`Finished retriggering ${retriggeredCount} memos.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
