import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 실제 서비스 시에는 .env 파일에 환경변수로 분리하는 것이 좋습니다.
const firebaseConfig = {
  apiKey: "AIzaSyDqeQ2SMtMvJQNVzSw8ywvrfNx80SrA_UM",
  authDomain: "q-rate-95494.firebaseapp.com",
  projectId: "q-rate-95494",
  storageBucket: "q-rate-95494.firebasestorage.app",
  messagingSenderId: "830060360568",
  appId: "1:830060360568:web:c42616584d0f5fdfd14e8d",
  measurementId: "G-7JSZ9QCGEH"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Auth와 Firestore 인스턴스 내보내기
export const auth = getAuth(app);
export const db = getFirestore(app);