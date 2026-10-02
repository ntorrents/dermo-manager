import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { Loader2 } from "lucide-react";

export const RequireSuperadmin = ({ children }) => {
	const { user, loading: authLoading } = useAuth();
	const { isPlatformSuperadmin, loading: tenantLoading } = useTenant();

	if (authLoading || tenantLoading) {
		return (
			<div className="min-h-[40vh] flex items-center justify-center">
				<Loader2 className="animate-spin text-rose-700" size={28} />
			</div>
		);
	}

	if (!user || !isPlatformSuperadmin) {
		return <Navigate to="/" replace />;
	}

	return children;
};
