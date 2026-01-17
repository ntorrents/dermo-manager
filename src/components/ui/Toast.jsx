// /Users/nilto/Documents/GitHub/DermoManager/src/components/ui/Toast.jsx
import React, { useEffect } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";

export const Toast = ({ message, type, onClose }) => {
	useEffect(() => {
		const t = setTimeout(onClose, 3000);
		return () => clearTimeout(t);
	}, [onClose]);
	return (
		<div
			className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-5 fade-in duration-300 ${
				type === "success"
					? "bg-emerald-50 text-emerald-800 border border-emerald-100"
					: "bg-rose-50 text-rose-800 border border-rose-100"
			}`}>
			{type === "success" ? (
				<CheckCircle size={20} />
			) : (
				<AlertCircle size={20} />
			)}
			<span className="font-medium text-sm">{message}</span>
		</div>
	);
};
