import React from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { RequireModule } from "../guards/RequireModule";
import { ProductsCatalogView } from "./catalog/ProductsCatalogView";
import { ProductsSalesView } from "./sales/ProductsSalesView";

export const ProductsShell = ({ user, showToast, clinic, profile, entries = [] }) => {
	const location = useLocation();

	const subnav = [
		{ to: "/productos", end: true, label: "Catálogo" },
		{ to: "/productos/ventas", label: "Ventas" },
	];

	return (
		<RequireModule module="products_catalog">
			<div className="space-y-6">
				<nav className="flex flex-nowrap gap-1.5 overflow-x-auto p-1 rounded-2xl bg-gray-100/80 -mx-1 px-1 [scrollbar-width:thin]">
					{subnav.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							end={item.end}
							className={({ isActive }) =>
								`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition ${
									isActive || (item.end && location.pathname === "/productos")
										? "bg-white text-rose-700 shadow-sm"
										: "text-gray-500 hover:text-gray-800"
								}`
							}>
							{item.label}
						</NavLink>
					))}
				</nav>

				<Routes>
					<Route
						index
						element={
							<ProductsCatalogView
								user={user}
								showToast={showToast}
								clinic={clinic}
								profile={profile}
								entries={entries}
							/>
						}
					/>
					<Route
						path="ventas"
						element={
							<ProductsSalesView
								user={user}
								showToast={showToast}
								clinic={clinic}
								profile={profile}
							/>
						}
					/>
					<Route path="*" element={<Navigate to="/productos" replace />} />
				</Routes>
			</div>
		</RequireModule>
	);
};
