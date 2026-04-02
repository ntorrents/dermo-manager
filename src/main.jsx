// /Users/nilto/Documents/GitHub/DermoManager/src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { TenantProvider } from "./context/TenantContext";
import { QueryProvider } from "./providers/QueryProvider";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<QueryProvider>
			<AuthProvider>
				<TenantProvider>
					<App />
				</TenantProvider>
			</AuthProvider>
		</QueryProvider>
	</StrictMode>,
);
