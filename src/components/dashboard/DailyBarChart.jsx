import React from "react";
import { formatCurrency } from "../../utils/format";

export const DailyBarChart = ({ data, currentMonth }) => {
	// 1. Preparar todos los días del mes
	const year = parseInt(currentMonth.split("-")[0]);
	const month = parseInt(currentMonth.split("-")[1]); // 1-12
	const daysInMonth = new Date(year, month, 0).getDate();

	// 2. Agrupar ingresos por día
	const dailyIncome = Array.from({ length: daysInMonth }, (_, i) => {
		const day = i + 1;
		// Buscamos entradas de ese día que sean INGRESOS
		const amount = data
			.filter((e) => {
				const eDay = parseInt(e.date.split("-")[2]);
				return eDay === day && e.type === "income";
			})
			.reduce((acc, curr) => acc + curr.amount, 0);

		return { day, amount };
	});

	// 3. Calcular el máximo para la escala (altura de las barras)
	const maxAmount = Math.max(...dailyIncome.map((d) => d.amount), 100); // Mínimo 100€ de escala

	return (
		<div className="w-full h-64 flex flex-col justify-end">
			<div className="flex items-end justify-between h-full gap-1 pt-4 pb-2 px-2">
				{dailyIncome.map((d) => {
					const heightPercentage = (d.amount / maxAmount) * 100;
					const isToday =
						new Date().getDate() === d.day &&
						new Date().getMonth() + 1 === month &&
						new Date().getFullYear() === year;

					return (
						<div
							key={d.day}
							className="flex-1 flex flex-col justify-end items-center group relative h-full">
							{/* Tooltip con cantidad al pasar el ratón */}
							<div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10 transition-opacity pointer-events-none">
								Día {d.day}: {formatCurrency(d.amount)}
							</div>

							{/* La Barra */}
							<div
								className={`w-full rounded-t-sm transition-all duration-500 ease-out ${
									d.amount > 0
										? isToday
											? "bg-rose-500"
											: "bg-rose-300 group-hover:bg-rose-400"
										: "bg-gray-100 h-1" // Pequeña línea gris si es 0
								}`}
								style={{
									height: d.amount > 0 ? `${heightPercentage}%` : "4px",
								}}></div>
						</div>
					);
				})}
			</div>
			{/* Eje X (Días clave: 1, 5, 10, 15...) */}
			<div className="flex justify-between text-[10px] text-gray-400 px-2 mt-1 border-t border-gray-100 pt-2">
				<span>Día 1</span>
				<span>15</span>
				<span>{daysInMonth}</span>
			</div>
		</div>
	);
};
