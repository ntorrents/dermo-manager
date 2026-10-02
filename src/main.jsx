// /Users/nilto/Documents/GitHub/DermoManager/src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { TenantProvider } from "./context/TenantContext";
import { AppearanceProvider } from "./context/AppearanceContext";
import { QueryProvider } from "./providers/QueryProvider";

import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<BrowserRouter>
			<QueryProvider>
				<AppearanceProvider>
					<AuthProvider>
						<TenantProvider>
							<App />
						</TenantProvider>
					</AuthProvider>
				</AppearanceProvider>
			</QueryProvider>
		</BrowserRouter>
	</StrictMode>,
);
