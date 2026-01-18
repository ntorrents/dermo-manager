import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

export const useClients = (user) => {
	const [clients, setClients] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) return;

		// Referencia a la subcolección 'clients' del usuario
		const q = query(
			collection(db, `users/${user.uid}/clients`),
			orderBy("createdAt", "desc"), // Los más nuevos primero
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const clientList = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));
			setClients(clientList);
			setLoading(false);
		});

		return () => unsubscribe();
	}, [user]);

	return { clients, loading };
};
