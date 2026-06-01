/**
 * Sugerencias de proveedor (HTML datalist), alineado con Finanzas.
 */
export const ProviderDatalist = ({ id, directory = [] }) => (
	<datalist id={id}>
		{directory
			.filter((s) => (s.name || "").trim().length > 0)
			.map((s) => (
				<option
					key={`${s.nif}-${s.name}`}
					value={s.name || ""}
					label={
						s.name
							? s.nif
								? `${s.name} (${s.nif})`
								: s.name
							: s.nif
								? `Sin nombre (${s.nif})`
								: "Proveedor"
					}
				/>
			))}
	</datalist>
);
