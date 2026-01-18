import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";

export const useClientHistory = (user, clientId) => {
	const [history, setHistory] = useState([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!user || !clientId) {
			setHistory([]);
			return;
		}

		const fetchHistory = async () => {
			setLoading(true);
			try {
				// Buscamos en finance_entries donde clientId coincida
				const q = query(
					collection(db, `users/${user.uid}/finance_entries`),
					where("clientId", "==", clientId),
					orderBy("date", "desc"), // Ordenar por fecha (más reciente arriba)
				);

				const snapshot = await getDocs(q);
				const entries = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}));
				setHistory(entries);
			} catch (error) {
				console.error("Error cargando historial:", error);
				// Si falla por falta de índice compuesto, al menos no rompe la app
			} finally {
				setLoading(false);
			}
		};

		fetchHistory();
	}, [user, clientId]);

	return { history, loading };
};
