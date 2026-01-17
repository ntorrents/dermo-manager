// /Users/nilto/Documents/GitHub/DermoManager/src/hooks/useData.js
import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

export const useData = (user) => {
	const [inventory, setInventory] = useState([]);
	const [treatments, setTreatments] = useState([]);
	const [entries, setEntries] = useState([]);
	const [recurringConfig, setRecurringConfig] = useState([]);

	useEffect(() => {
		if (!user) return;
		const base = `users/${user.uid}`;

		const unsub1 = onSnapshot(
			query(collection(db, `${base}/inventory`), orderBy("name")),
			(s) => setInventory(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
		);
		const unsub2 = onSnapshot(
			query(collection(db, `${base}/treatments`), orderBy("name")),
			(s) => setTreatments(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
		);
		const unsub3 = onSnapshot(
			query(collection(db, `${base}/finance_entries`), orderBy("date", "desc")),
			(s) => setEntries(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
		);
		const unsub4 = onSnapshot(
			query(collection(db, `${base}/recurring_config`), orderBy("name")),
			(s) => setRecurringConfig(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
		);

		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
		};
	}, [user]);

	return { inventory, treatments, entries, recurringConfig };
};
