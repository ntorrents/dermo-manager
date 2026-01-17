// /Users/nilto/Documents/GitHub/DermoManager/src/components/dashboard/SmoothAreaChart.jsx
import React from "react";
import { formatCurrency } from "../../utils/format";

export const SmoothAreaChart = ({ data }) => {
	const height = 100;
	const width = 300;
	const maxVal = Math.max(...data.map((d) => d.value), 10);

	const points = data
		.map((d, i) => {
			const x = (i / (data.length - 1)) * width;
			const y = height - (d.value / maxVal) * height;
			return `${x},${y}`;
		})
		.join(" ");

	const areaPoints = `${points} ${width},${height} 0,${height}`;

	return (
		<div className="w-full mt-4">
			<div className="relative h-40 w-full overflow-hidden">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					className="w-full h-full overflow-visible"
					preserveAspectRatio="none">
					<defs>
						<linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
							<stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
						</linearGradient>
					</defs>
					<polygon points={areaPoints} fill="url(#gradient)" />
					<polyline
						points={points}
						fill="none"
						stroke="#f43f5e"
						strokeWidth="3"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
					/>
					{data.map((d, i) => {
						const x = (i / (data.length - 1)) * width;
						const y = height - (d.value / maxVal) * height;
						return (
							<g key={i}>
								<circle
									cx={x}
									cy={y}
									r="3"
									fill="white"
									stroke="#f43f5e"
									strokeWidth="2"
									vectorEffect="non-scaling-stroke"
								/>
							</g>
						);
					})}
				</svg>
			</div>
			<div className="flex justify-between mt-2 text-xs text-gray-400 font-medium px-1">
				{data.map((d, i) => (
					<div key={i} className="flex flex-col items-center">
						<span>{d.label}</span>
						<span className="text-[10px] text-gray-300 font-normal">
							{formatCurrency(d.value)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
};
