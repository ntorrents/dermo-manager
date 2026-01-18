export const exportToCSV = (entries, filename = "contabilidad.csv") => {
	if (!entries || entries.length === 0) {
		alert("No hay datos para exportar");
		return;
	}

	// 1. Definir Encabezados (Lo que saldrá en la primera fila de Excel)
	const headers = [
		"Fecha",
		"Tipo",
		"Categoría",
		"Descripción / Concepto",
		"Cliente",
		"Ingreso (€)",
		"Gasto (€)",
		"Resultado (€)", // Útil para filtros rápidos en Excel
	];

	// 2. Convertir cada entrada en una fila
	const rows = entries.map((entry) => {
		// Preparar datos limpios
		const date = entry.date;
		const type = entry.type === "income" ? "Ingreso" : "Gasto";
		const category = entry.category || "General";
		// En Excel, si el texto tiene comas, hay que ponerlo entre comillas
		const description = `"${(entry.description || "").replace(/"/g, '""')}"`;
		const client = entry.clientNameSnapshot
			? `"${entry.clientNameSnapshot}"`
			: "-";

		// Separamos importes en columnas diferentes para facilitar sumas en Excel
		const income = entry.type === "income" ? entry.amount : 0;
		const expense = entry.type === "expense" ? entry.amount : 0;
		const net = entry.type === "income" ? entry.amount : -entry.amount;

		return [
			date,
			type,
			category,
			description,
			client,
			income.toString().replace(".", ","), // Excel en España usa coma decimal
			expense.toString().replace(".", ","),
			net.toString().replace(".", ","),
		].join(";"); // Usamos punto y coma (;) que es el estándar de Excel en España/Europa
	});

	// 3. Unir todo con el BOM (para que se vean bien las tildes y ñ)
	const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");

	// 4. Crear el Blob y descargar
	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const link = document.createElement("a");
	const url = URL.createObjectURL(blob);

	link.setAttribute("href", url);
	link.setAttribute("download", filename);
	link.style.visibility = "hidden";

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
};
