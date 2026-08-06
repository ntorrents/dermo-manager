const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

// Add imports
code = code.replace(
  'import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";',
  'import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";\nimport { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";'
);

// Add PATH_MAP
const pathMapStr = `
const PATH_MAP = {
	dashboard: "/",
	clients: "/clientes",
	treatments: "/tratamientos",
	bonos: "/bonos",
	documents: "/documentos",
	inventory: "/inventario",
	calendar: "/agenda",
	finance_movements: "/finanzas/movimientos",
	invoices: "/facturacion",
	financial_analysis: "/finanzas/analisis",
	suppliers: "/proveedores",
	taxes: "/impuestos",
	assets: "/impuestos/bienes-inversion",
	settings: "/configuracion",
	budgets: "/finanzas/presupuestos"
};
`;

code = code.replace('const DermoManager = () => {', pathMapStr + '\nconst DermoManager = () => {');

// Handle activeTab state replacement
const hookStr = `
	const location = useLocation();
	const navigate = useNavigate();

	const activeTab = useMemo(() => {
		const p = location.pathname;
		if (p.startsWith("/clientes")) return "clients";
		if (p.startsWith("/tratamientos")) return "treatments";
		if (p.startsWith("/bonos")) return "bonos";
		if (p.startsWith("/documentos")) return "documents";
		if (p.startsWith("/inventario")) return "inventory";
		if (p.startsWith("/agenda")) return "calendar";
		if (p.startsWith("/finanzas/movimientos")) return "finance_movements";
		if (p.startsWith("/finanzas/presupuestos")) return "budgets";
		if (p.startsWith("/finanzas/analisis")) return "financial_analysis";
		if (p.startsWith("/facturacion")) return "invoices";
		if (p.startsWith("/proveedores")) return "suppliers";
		if (p.startsWith("/impuestos/bienes-inversion")) return "assets";
		if (p.startsWith("/impuestos")) return "taxes";
		if (p.startsWith("/configuracion")) return "settings";
		return "dashboard";
	}, [location.pathname]);

	const setActiveTab = useCallback((tabId) => {
		const targetPath = PATH_MAP[tabId] || "/";
		navigate(targetPath);
	}, [navigate]);
`;
code = code.replace('const [activeTab, setActiveTab] = useState("dashboard");', hookStr);

// In DermoManager, replace setActiveTab logic
code = code.replace(
  'if (!allowsPresupuestosBonos && activeTab === "bonos") setActiveTab("dashboard");',
  'if (!allowsPresupuestosBonos && activeTab === "bonos") navigate("/");'
);

code = code.replace('const goSettings = useCallback(() => setActiveTab("settings"), []);', 'const goSettings = useCallback(() => navigate("/configuracion"), [navigate]);');

code = code.replace('setActiveTab("invoices");', 'navigate("/facturacion");');
code = code.replace('setActiveTab("finance");', 'navigate("/finanzas/movimientos");');
code = code.replace('setActiveTab("treatments");', 'navigate("/tratamientos");');
code = code.replace('setActiveTab("calendar");', 'navigate("/agenda");');
// There is a second calendar navigation inside if (g === "error")
code = code.replace('setActiveTab("calendar");', 'navigate("/agenda");');

fs.writeFileSync('src/App.jsx.temp', code);
