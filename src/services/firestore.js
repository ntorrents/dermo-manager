// /Users/nilto/Documents/GitHub/DermoManager/src/services/firestore.js
import {
	collection,
	addDoc,
	updateDoc,
	deleteDoc,
	doc,
} from "firebase/firestore";
import { db } from "./firebase";

export const addDocument = (userId, collectionName, data) =>
	addDoc(collection(db, `users/${userId}/${collectionName}`), data);

export const updateDocument = (userId, collectionName, docId, data) =>
	updateDoc(doc(db, `users/${userId}/${collectionName}`, docId), data);

export const deleteDocument = (userId, collectionName, docId) =>
	deleteDoc(doc(db, `users/${userId}/${collectionName}`, docId));
