import React from "react";
import { Eye, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../../context/TenantContext";

export const ImpersonationBanner = () => {
	const navigate = useNavigate();
	const { isImpersonating, clinicName, clinicId, stopImpersonation } = useTenant();

	if (!isImpersonating) return null;

	return (
		<div className="sticky top-0 z-[60] bg-amber-500 text-amber-950 px-4 py-2.5 shadow-md">
			<div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-sm">
				<p className="font-bold inline-flex items-center gap-2">
					<Eye size={16} />
					Viendo como clínica:{" "}
					<span className="underline decoration-2">{clinicName || clinicId}</span>
				</p>
				<button
					type="button"
					onClick={async () => {
						await stopImpersonation();
						navigate("/superadmin", { replace: true });
					}}
					className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950 text-amber-50 px-3 py-1.5 text-xs font-black hover:bg-black">
					<X size={14} /> Volver a Superadmin
				</button>
			</div>
		</div>
	);
};
