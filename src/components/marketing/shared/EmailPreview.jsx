import React, { useMemo } from "react";
import {
	applyEmailVariables,
	withBaseClinicaFooter,
} from "../../../utils/emailBranding";

export const EmailPreview = ({
	bodyHtml = "",
	clinicName = "Clínica",
	sampleName = "Cliente",
	className = "",
}) => {
	const previewHtml = useMemo(() => {
		const vars = {
			nombre_paciente: sampleName || "Cliente",
			client_name: sampleName || "Cliente",
			nombre_clinica: clinicName || "Clínica",
			clinic_name: clinicName || "Clínica",
			fecha_cita: new Date().toLocaleDateString("es-ES"),
			appointment_date: new Date().toLocaleDateString("es-ES"),
			treatment_name: "tu tratamiento",
		};
		return withBaseClinicaFooter(applyEmailVariables(bodyHtml, vars));
	}, [bodyHtml, clinicName, sampleName]);

	return (
		<div className={className}>
			<p className="text-sm font-black text-gray-900 mb-1">Previsualización</p>
			<p className="text-[11px] text-gray-400 mb-3">
				Incluye pie institucional BaseClínica (no editable)
			</p>
			<div
				className="prose prose-sm max-w-none border border-gray-100 rounded-xl p-4 bg-gray-50 max-h-[420px] overflow-y-auto"
				dangerouslySetInnerHTML={{ __html: previewHtml }}
			/>
		</div>
	);
};
