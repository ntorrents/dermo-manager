import React from "react";
import { Loader2 } from "lucide-react";

export const LoadingButton = ({
	children,
	loading = false,
	disabled,
	className = "",
	...props
}) => (
	<button
		disabled={disabled || loading}
		className={`flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
		{...props}>
		{loading ? (
			<Loader2 size={18} className="animate-spin shrink-0" />
		) : null}
		{children}
	</button>
);
