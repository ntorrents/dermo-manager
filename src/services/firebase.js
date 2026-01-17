// /Users/nilto/Documents/GitHub/DermoManager/src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
	apiKey: "AIzaSyAb1p23xRpeoR6Ycshis8C7r8eBO-IgIqc",
	authDomain: "dermo-gestion-christine.firebaseapp.com",
	projectId: "dermo-gestion-christine",
	storageBucket: "dermo-gestion-christine.firebasestorage.app",
	messagingSenderId: "890222498918",
	appId: "1:890222498918:web:71e34f4587e0fff209c9a7",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
