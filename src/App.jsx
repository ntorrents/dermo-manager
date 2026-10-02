import React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { useTenant } from "./context/TenantContext";
import { LoginScreen } from "./components/auth/LoginScreen";
import { ClinicErpApp } from "./components/app/ClinicErpApp";
import { PlatformConsole } from "./components/superadmin/PlatformConsole";
import { ImpersonationBanner } from "./components/superadmin/ImpersonationBanner";

/**
 * Router de autenticación:
 * - sin sesión → Login
 * - JWT superadmin sin impersonar → consola plataforma
 * - superadmin impersonando / usuarios clínica → ERP
 */
const App = () => {
	const { user, loading: authLoading } = useAuth();
	const { isPlatformSuperadmin, isImpersonating, loading: tenantLoading } = useTenant();

	if (authLoading || (user && tenantLoading)) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-app">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="animate-spin text-primary" size={40} />
					<p className="text-primary font-medium">Cargando…</p>
				</div>
			</div>
		);
	}

	if (!user) return <LoginScreen />;

	if (isPlatformSuperadmin && !isImpersonating) {
		return <PlatformConsole />;
	}

	return (
		<>
			{isPlatformSuperadmin && isImpersonating && <ImpersonationBanner />}
			<ClinicErpApp />
		</>
	);
};

export default App;
