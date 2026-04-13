import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDY8Qkn0TfzHNRV0BCu16UV--TCxfUqSng",
  authDomain: "misiky.firebaseapp.com",
  projectId: "misiky",
  storageBucket: "misiky.firebasestorage.app",
  messagingSenderId: "428720804465",
  appId: "1:428720804465:web:f5af55529bb75e87cfc1d0",
  measurementId: "G-1KHY6HB5LN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 使用最持久的 persistence（IndexedDB-based），不會被 iOS ITP 清除
setPersistence(auth, browserLocalPersistence).catch(() => {});

export { app, auth };
