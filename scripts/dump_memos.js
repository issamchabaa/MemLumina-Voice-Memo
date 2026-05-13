import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function check() {
  await signInWithEmailAndPassword(auth, 'issam.chabaa@gmail.com', 'Un2345678');
  const user = auth.currentUser;
  
  const q = query(collection(db, `users/${user.uid}/voice_memos`), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  
  const memos = [];
  snap.forEach(doc => memos.push({ id: doc.id, ...doc.data() }));
  
  console.log(`Found ${memos.length} total memos in DB.`);

  const needsAttention = memos.filter(m => ['recorded', 'transcribed', 'error', 'local-only'].includes(m.status))
  const inProgress = memos.filter(m => ['transcribing', 'uploading', 'submitted'].includes(m.status))
  const completed = memos.filter(m => {
    if (m.status !== 'processed') return false
    if (!m.updatedAt || !m.updatedAt.toDate) return true
    return (Date.now() - m.updatedAt.toDate().getTime()) < 24 * 60 * 60 * 1000
  });

  console.log('Needs Attention:', needsAttention.length);
  needsAttention.forEach((m, i) => console.log(`  ${i}: id=${m.id} text=${m.transcriptText?.substring(0, 20)}`));

  console.log('In Progress:', inProgress.length);
  console.log('Completed:', completed.length);
  
  process.exit(0);
}

check().catch(console.error);
