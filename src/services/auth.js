// /Users/nilto/Documents/GitHub/DermoManager/src/services/auth.js
import {
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	GoogleAuthProvider,
	signInWithPopup,
	updateProfile,
	updatePassword,
	EmailAuthProvider, // Importación añadida
	reauthenticateWithCredential, // Importación añadida
} from "firebase/auth";
import { auth } from "./firebase";

export const loginWithEmail = (email, password) =>
	signInWithEmailAndPassword(auth, email, password);

export const registerWithEmail = (email, password) =>
	createUserWithEmailAndPassword(auth, email, password);

export const loginWithGoogle = () =>
	signInWithPopup(auth, new GoogleAuthProvider());

export const logout = () => signOut(auth);

export const updateUserProfile = (user, data) => updateProfile(user, data);

export const updateUserPassword = (user, password) =>
	updatePassword(user, password);

// Nueva función para re-autenticar al usuario antes de cambios sensibles
export const reauthenticate = async (user, currentPassword) => {
	const credential = EmailAuthProvider.credential(user.email, currentPassword);
	return await reauthenticateWithCredential(user, credential);
};
