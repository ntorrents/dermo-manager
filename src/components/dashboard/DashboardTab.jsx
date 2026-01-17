// /Users/nilto/Documents/GitHub/DermoManager/src/components/dashboard/DashboardTab.jsx
import React, { useMemo } from "react";
import { TrendingUp, Sparkles, Package, Home, Tag } from "lucide-react";
import { StatCard } from "./StatCard";
import { SmoothAreaChart } from "./SmoothAreaChart";
import { formatCurrency } from "../../utils/format";

export const DashboardTab = ({
	user,
	entries,
	currentMonth,
	setCurrentMonth,
	userName,
}) => {
	const filteredEntries = useMemo(
		() => entries.filter((e) => e.date.startsWith(currentMonth)),
		[entries, currentMonth],
	);

	const income = filteredEntries
		.filter((e) => e.type === "income")
		.reduce((acc, c) => acc + c.amount, 0);
	const expenseMaterial = filteredEntries
		.filter((e) => e.category === "Material")
		.reduce((acc, c) => acc + c.amount, 0);
	const expenseFixed = filteredEntries
		.filter((e) => e.category === "Fijo")
		.reduce((acc, c) => acc + c.amount, 0);
	const expenseOther = filteredEntries
		.filter(
			(e) =>
				e.type === "expense" &&
				e.category !== "Material" &&
				e.category !== "Fijo",
		)
		.reduce((acc, c) => acc + c.amount, 0);
	const netProfit = income - (expenseMaterial + expenseFixed + expenseOther);

	const chartData = useMemo(() => {
		const data = [];
		for (let i = 5; i >= 0; i--) {
			const d = new Date();
			d.setMonth(d.getMonth() - i);
			const key = d.toISOString().slice(0, 7);
			const val = entries
				.filter((e) => e.date.startsWith(key) && e.type === "income")
				.reduce((acc, c) => acc + c.amount, 0);
			data.push({
				label: d.toLocaleString("es-ES", { month: "short" }),
				value: val,
			});
		}
		return data;
	}, [entries]);

	return (
		<div className="space-y-6 animate-in fade-in">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold">
						Hola, {userName || user.email?.split("@")[0]}
					</h2>
					<p className="text-sm text-gray-500">
						Tu negocio en {new Date().getFullYear()}
					</p>
				</div>
				<input
					type="month"
					value={currentMonth}
					onChange={(e) => setCurrentMonth(e.target.value)}
					className="bg-white border rounded-lg p-2 text-sm font-bold shadow-sm"
				/>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
				<div className="lg:col-span-1">
					<StatCard
						title="Facturación"
						value={formatCurrency(income)}
						subtext="Bruto Total"
						gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
						icon={TrendingUp}
					/>
				</div>
				<div className="lg:col-span-1">
					<StatCard
						title="Beneficio Neto"
						value={formatCurrency(netProfit)}
						subtext="En Caja"
						gradient="bg-gradient-to-br from-rose-500 to-purple-600"
						icon={Sparkles}
					/>
				</div>
				<div className="lg:col-span-1">
					<StatCard
						title="Material"
						value={formatCurrency(expenseMaterial)}
						subtext="Variable"
						gradient="bg-gradient-to-br from-blue-400 to-blue-600"
						icon={Package}
					/>
				</div>
				<div className="lg:col-span-1">
					<StatCard
						title="Gastos Fijos"
						value={formatCurrency(expenseFixed)}
						subtext="Estructura"
						gradient="bg-gradient-to-br from-orange-400 to-orange-600"
						icon={Home}
					/>
				</div>
				<div className="lg:col-span-1">
					<StatCard
						title="Otros/Inv."
						value={formatCurrency(expenseOther)}
						subtext="Extras"
						gradient="bg-gradient-to-br from-gray-500 to-gray-700"
						icon={Tag}
					/>
				</div>
			</div>
			<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
				<h3 className="font-bold text-gray-700 mb-2">Tendencia de Ingresos</h3>
				<SmoothAreaChart data={chartData} />
			</div>
		</div>
	);
};
