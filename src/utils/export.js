import { supabase } from "../services/supabase";
import { getReceiptSignedUrl } from "../services/receiptStorage";

const getXlsx = async () => import("xlsx");
const getZipAndSaver = async () => {
	const [{ default: JSZip }, { saveAs }] = await Promise.all([
		import("jszip"),
		import("file-saver"),
	]);
	return { JSZip, saveAs };
};

/**
 * Exporta trimestre (o periodo actual) a Excel con hojas Ventas y Compras para el gestor/303.
 */
export const exportTrimestreToExcel = async (
	ventasEntries = [],
	expenses = [],
	clients = [],
	filename = "Exportacion_trimestre.xlsx",
) => {
	const XLSX = await getXlsx();
	const ventasRows = ventasEntries.map((e) => {
		const client = clients.find((c) => c.id === e.client_id);
		const clientName = client ? `${client.name || ""} ${client.surname || ""}`.trim() : "";
		const nif = client?.nif || "";
		return [
			e.date,
			e.invoice_number || "",
			clientName,
			nif,
			Number(e.tax_base) ?? Number(e.amount) ?? 0,
			Number(e.tax_amount) ?? 0,
			Number(e.total_amount ?? e.amount) ?? 0,
		];
	});
	const comprasRows = expenses.map((e) => [
		e.date,
		e.invoice_number || "",
		e.provider_name || "",
		e.provider_nif || "",
		Number(e.tax_base) ?? 0,
		Number(e.tax_amount) ?? 0,
		Number(e.total_amount) ?? 0,
		e.category || "General",
	]);

	const wsVentas = XLSX.utils.aoa_to_sheet([
		["Fecha", "Nº Factura", "Cliente", "NIF", "Base", "IVA", "Total"],
		...ventasRows,
	]);
	const wsCompras = XLSX.utils.aoa_to_sheet([
		["Fecha", "Nº Factura Prov.", "Proveedor", "NIF", "Base", "IVA", "Total", "Categoría"],
		...comprasRows,
	]);

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");
	XLSX.utils.book_append_sheet(wb, wsCompras, "Compras");
	XLSX.writeFile(wb, filename);
};

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

/**
 * Exporta trimestre completo: Excel + todos los PDFs/imágenes de facturas deducibles en un ZIP
 */
export const exportTrimestreToZip = async (
	entries = [],
	clients = [],
	year,
	quarter,
	userId,
	showToast = () => {}
) => {
	try {
		const XLSX = await getXlsx();
		const { JSZip, saveAs } = await getZipAndSaver();
		showToast("Generando exportación...", "info");
		
		// Filtrar entradas del trimestre
		const quarterStartMonth = (quarter - 1) * 3;
		const startDate = `${year}-${String(quarterStartMonth + 1).padStart(2, "0")}-01`;
		const endMonth = quarter * 3;
		const endDay = new Date(year, endMonth, 0).getDate();
		const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
		
		const quarterEntries = entries.filter(
			(e) => e.date >= startDate && e.date <= endDate
		);
		
		// Separar ingresos (excl. Plan Amigo) y gastos deducibles
		const ventas = quarterEntries.filter((e) => e.type === "income" && Number(e.amount) > 0 && !e.plan_amigo);
		const compras = quarterEntries.filter((e) => e.type === "expense" && e.is_deductible === true);
		
		// Crear Excel
		const ventasRows = ventas.map((e) => {
			const client = clients.find((c) => c.id === e.client_id);
			const clientName = client ? `${client.name || ""} ${client.surname || ""}`.trim() : "";
			const nif = client?.nif || "";
			return [
				e.date,
				e.invoice_number || "",
				clientName,
				nif,
				Number(e.tax_base ?? e.base_amount ?? e.amount) ?? 0,
				Number(e.tax_amount) ?? 0,
				Number(e.total_amount ?? e.amount) ?? 0,
			];
		});
		
		// Agrupar compras por factura (mismo NIF + número) para mostrar totales
		const groupedCompras = {};
		compras.forEach((e) => {
			const key = `${e.supplier_nif || ""}_${e.invoice_number || ""}`;
			if (!groupedCompras[key]) {
				groupedCompras[key] = {
					date: e.date,
					invoice_number: e.invoice_number || "",
					supplier_nif: e.supplier_nif || "",
					description: e.description || "",
					category: e.category || "General",
					materials: [e.description || ""],
					tax_base: Number(e.tax_base ?? e.base_amount ?? e.amount) ?? 0,
					tax_amount: Number(e.tax_amount) ?? 0,
					total_amount: Number(e.total_amount ?? e.amount) ?? 0,
					count: 1,
				};
			} else {
				groupedCompras[key].tax_base += Number(e.tax_base ?? e.base_amount ?? e.amount) ?? 0;
				groupedCompras[key].tax_amount += Number(e.tax_amount) ?? 0;
				groupedCompras[key].total_amount += Number(e.total_amount ?? e.amount) ?? 0;
				groupedCompras[key].count++;
				if (e.description && !groupedCompras[key].materials.includes(e.description)) {
					groupedCompras[key].materials.push(e.description);
				}
			}
		});
		
		const comprasRows = Object.values(groupedCompras).map((group) => [
			group.date,
			group.invoice_number,
			group.count > 1 ? `${group.materials[0]} (+${group.count - 1} más)` : group.description,
			group.supplier_nif,
			group.tax_base,
			group.tax_amount,
			group.total_amount,
			group.category,
		]);
		
		const wsVentas = XLSX.utils.aoa_to_sheet([
			["Fecha", "Nº Factura", "Cliente", "NIF", "Base", "IVA", "Total"],
			...ventasRows,
		]);
		const wsCompras = XLSX.utils.aoa_to_sheet([
			["Fecha", "Nº Factura Prov.", "Proveedor", "NIF", "Base", "IVA", "Total", "Categoría"],
			...comprasRows,
		]);
		
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");
		XLSX.utils.book_append_sheet(wb, wsCompras, "Compras");
		const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
		
		// Crear ZIP
		const zip = new JSZip();
		zip.file(`Exportacion_${year}_T${quarter}.xlsx`, excelBuffer);
		
		// Descargar archivos de facturas deducibles (deduplicar por file_url)
		const filesToDownload = compras.filter((e) => e.file_url);
		// Crear un Set para deduplicar por file_url
		const uniqueFileUrls = [...new Set(filesToDownload.map((e) => e.file_url))];
		
		showToast(`Descargando ${uniqueFileUrls.length} justificantes únicos...`, "info");
		
		// Mapa para rastrear qué archivos ya se han descargado
		const downloadedFiles = new Map();
		
		for (const fileUrl of uniqueFileUrls) {
			// Si ya lo descargamos, saltarlo
			if (downloadedFiles.has(fileUrl)) continue;
			
			try {
				const signedUrl = await getReceiptSignedUrl(fileUrl);
				if (!signedUrl) continue;
				
				const response = await fetch(signedUrl);
				if (!response.ok) continue;
				
				const blob = await response.blob();
				
				// Buscar la entrada correspondiente para obtener datos de la factura
				const entry = compras.find((e) => e.file_url === fileUrl);
				let fileName = `factura.pdf`;
				
				if (entry && entry.supplier_nif && entry.invoice_number) {
					// Nombre descriptivo: Factura_NIF_Numero.pdf
					const nifClean = entry.supplier_nif.replace(/[^a-zA-Z0-9]/g, "_");
					const invoiceClean = entry.invoice_number.replace(/[^a-zA-Z0-9]/g, "_");
					const ext = fileUrl.split(".").pop()?.toLowerCase() || "pdf";
					fileName = `Factura_${nifClean}_${invoiceClean}.${ext}`;
				} else {
					fileName = fileUrl.split("/").pop() || `factura.pdf`;
				}
				
				const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
				
				// Si el archivo ya existe en el ZIP, añadir sufijo
				let finalFileName = sanitizedFileName;
				let counter = 1;
				while (downloadedFiles.has(finalFileName)) {
					const ext = sanitizedFileName.split(".").pop();
					const nameWithoutExt = sanitizedFileName.replace(`.${ext}`, "");
					finalFileName = `${nameWithoutExt}_${counter}.${ext}`;
					counter++;
				}
				
				zip.file(`justificantes/${finalFileName}`, blob);
				downloadedFiles.set(fileUrl, finalFileName);
			} catch (err) {
				console.error(`Error descargando ${fileUrl}:`, err);
			}
		}
		
		// Generar y descargar ZIP
		const zipBlob = await zip.generateAsync({ type: "blob" });
		const zipFileName = `Exportacion_${year}_T${quarter}.zip`;
		saveAs(zipBlob, zipFileName);
		
		showToast("Exportación completada", "success");
	} catch (error) {
		console.error("Error exportando ZIP:", error);
		showToast("Error al generar exportación", "error");
	}
};
