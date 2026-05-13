const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'sheep-db1'
});
async function run() {
  const db = admin.firestore();
  const cols = await db.listCollections();
  console.log('Collections:', cols.map(c => c.id));
  process.exit(0);
}
run();
