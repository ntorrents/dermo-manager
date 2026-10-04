import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

/**
 * Ranking de rendimiento con sparkbars (importe vs total del ranking).
 * items: [{ name, amount, count }]
 */
export const WidgetTopTratamientos = ({ topTreatments = [], topRevenue = null }) => {
	const items = useMemo(() => {
		const source = (topRevenue?.length ? topRevenue : topTreatments) || [];
		return source.slice(0, 5);
	}, [topRevenue, topTreatments]);

	const totalAmount = useMemo(
		() => items.reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
		[items],
	);

	return (
		<section className="h-full min-h-[240px] rounded-2xl border border-edge bg-surface p-5 shadow-sm flex flex-col">
			<div className="mb-4">
				<p className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1.5">
					<TrendingUp size={13} /> Ranking de rendimiento
				</p>
				<p className="text-sm text-muted mt-0.5">
					Top tratamientos y productos del periodo
				</p>
			</div>

			{items.length === 0 ? (
				<div className="flex-1 flex items-center justify-center text-sm text-muted">
					Sin ingresos en el periodo
				</div>
			) : (
				<ul className="space-y-3 flex-1">
					{items.map((t) => {
						const amount = Number(t.amount) || 0;
						const pct =
							totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;
						return (
							<li key={t.name} className="relative">
								<div
									className="absolute inset-y-0 left-0 rounded-lg bg-primary-soft"
									style={{ width: `${Math.max(pct, 4)}%` }}
									aria-hidden
								/>
								<div className="relative flex items-baseline justify-between gap-3 px-2 py-1.5">
									<div className="min-w-0">
										<p className="text-sm font-semibold text-fg truncate">
											{t.name}
										</p>
										<p className="text-[11px] text-muted tabular-nums">
											{t.count} {t.count === 1 ? "venta" : "ventas"} · {pct}%
										</p>
									</div>
									<p className="text-sm font-semibold text-fg tabular-nums shrink-0">
										{formatCurrency(amount)}
									</p>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
};
