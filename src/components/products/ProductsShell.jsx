import React from "react";
import { Outlet } from "react-router-dom";
import { PageTabs } from "../ui/PageTabs";

/** Subnav Productos (Catálogo | Ventas) dentro de Catálogo. */
export const ProductsShell = () => {
	const tabs = [
		{ to: "/catalogo/productos", end: true, label: "Catálogo" },
		{ to: "/catalogo/productos/ventas", label: "Ventas" },
	];

	return (
		<div className="space-y-4">
			<PageTabs items={tabs} />
			<Outlet />
		</div>
	);
};
