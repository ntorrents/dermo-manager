// /Users/nilto/Documents/GitHub/DermoManager/src/hooks/useProfile.js
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

export const useProfile = (user) => {
	const [profile, setProfile] = useState(null);

	useEffect(() => {
		if (!user) return;
		// Escuchamos el documento 'profile' dentro de la subcolección 'settings' del usuario
		const unsubscribe = onSnapshot(
			doc(db, `users/${user.uid}/settings/profile`),
			(docSnapshot) => {
				if (docSnapshot.exists()) {
					setProfile(docSnapshot.data());
				} else {
					setProfile({});
				}
			},
		);

		return () => unsubscribe();
	}, [user]);

	return profile;
};
