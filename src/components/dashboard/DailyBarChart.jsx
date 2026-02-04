import React from "react";
import { formatCurrency } from "../../utils/format";

export const DailyBarChart = ({ data, currentMonth }) => {
	const year = parseInt(currentMonth.split("-")[0]);
	const month = parseInt(currentMonth.split("-")[1]);
	const daysInMonth = new Date(year, month, 0).getDate();

	const dailyIncome = Array.from({ length: daysInMonth }, (_, i) => {
		const day = i + 1;
		const amount = data
			.filter((e) => {
				if (!e.date) return false;
				const eDay = parseInt(e.date.split("-")[2]);
				return eDay === day && e.type === "income";
			})
			.reduce((acc, curr) => acc + Number(curr.amount || 0), 0); // Conversión segura

		return { day, amount };
	});

	const maxAmount = Math.max(...dailyIncome.map((d) => d.amount), 100);

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
							<div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10 pointer-events-none">
								Día {d.day}: {formatCurrency(d.amount)}
							</div>
							<div
								className={`w-full rounded-t-sm transition-all duration-500 ease-out ${
									d.amount > 0
										? isToday
											? "bg-rose-500"
											: "bg-rose-300 group-hover:bg-rose-400"
										: "bg-gray-100 h-1"
								}`}
								style={{
									height: d.amount > 0 ? `${heightPercentage}%` : "4px",
								}}></div>
						</div>
					);
				})}
			</div>
			<div className="flex justify-between text-[10px] text-gray-400 px-2 mt-1 border-t border-gray-100 pt-2">
				<span>Día 1</span>
				<span>15</span>
				<span>{daysInMonth}</span>
			</div>
		</div>
	);
};
