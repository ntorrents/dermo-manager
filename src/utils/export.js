import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "../services/supabase";
import { getReceiptSignedUrl } from "../services/receiptStorage";

/**
 * Exporta trimestre (o periodo actual) a Excel con hojas Ventas y Compras para el gestor/303.
 */
export const exportTrimestreToExcel = (ventasEntries = [], expenses = [], clients = [], filename = "Exportacion_trimestre.xlsx") => {
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
		
		// Separar ingresos y gastos deducibles
		const ventas = quarterEntries.filter((e) => e.type === "income" && Number(e.amount) > 0);
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
		
		const comprasRows = compras.map((e) => [
			e.date,
			e.invoice_number || "",
			e.description || "",
			e.supplier_nif || "",
			Number(e.tax_base ?? e.base_amount ?? e.amount) ?? 0,
			Number(e.tax_amount) ?? 0,
			Number(e.total_amount ?? e.amount) ?? 0,
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
		const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
		
		// Crear ZIP
		const zip = new JSZip();
		zip.file(`Exportacion_${year}_T${quarter}.xlsx`, excelBuffer);
		
		// Descargar archivos de facturas deducibles
		const filesToDownload = compras.filter((e) => e.file_url);
		showToast(`Descargando ${filesToDownload.length} justificantes...`, "info");
		
		for (const entry of filesToDownload) {
			try {
				const signedUrl = await getReceiptSignedUrl(entry.file_url);
				const response = await fetch(signedUrl);
				if (!response.ok) continue;
				
				const blob = await response.blob();
				const fileName = entry.file_url.split("/").pop() || `factura_${entry.id}.pdf`;
				const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
				zip.file(`justificantes/${sanitizedFileName}`, blob);
			} catch (err) {
				console.error(`Error descargando ${entry.file_url}:`, err);
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
