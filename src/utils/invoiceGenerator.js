import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./format"; // Asegúrate de que esta ruta es correcta

export const generateInvoice = (entry, client, profile) => {
	const doc = new jsPDF();
	const pageWidth = doc.internal.pageSize.width;

	// --- 1. CABECERA (Datos de la Empresa/Médico) ---
	doc.setFontSize(20);
	doc.setTextColor(225, 29, 72); // Rose-600
	doc.text(profile?.companyName || "DermoApp", 14, 22);

	doc.setFontSize(10);
	doc.setTextColor(100);
	// Datos del doctor/empresa
	const drName = profile?.name
		? `${profile.name} ${profile.surname || ""}`
		: "";
	doc.text(drName, 14, 30);
	if (profile?.collegiateNumber)
		doc.text(`Nº Col: ${profile.collegiateNumber}`, 14, 35);
	if (profile?.mobile) doc.text(`Tel: ${profile.mobile}`, 14, 40);

	// --- 2. DATOS DE LA FACTURA (Derecha) ---
	const invoiceNum = `F-${entry.date.replace(/-/g, "")}-${entry.id.slice(0, 4).toUpperCase()}`;

	doc.setFontSize(11);
	doc.setTextColor(0);
	doc.text("FACTURA", pageWidth - 14, 22, { align: "right" });

	doc.setFontSize(10);
	doc.setTextColor(100);
	doc.text(`Nº: ${invoiceNum}`, pageWidth - 14, 30, { align: "right" });
	doc.text(`Fecha: ${entry.date}`, pageWidth - 14, 35, { align: "right" });

	// --- 3. DATOS DEL CLIENTE (Caja gris) ---
	doc.setFillColor(249, 250, 251); // Gray-50
	doc.rect(14, 50, pageWidth - 28, 25, "F");

	doc.setFontSize(9);
	doc.setTextColor(156, 163, 175); // Gray-400
	doc.text("FACTURAR A:", 18, 58);

	doc.setFontSize(10);
	doc.setTextColor(0);
	doc.text(`${client.name} ${client.surname || ""}`, 18, 65);
	if (client.address) doc.text(client.address, 18, 70);
	// Si tuvieras DNI del cliente, iría aquí

	// --- 4. TABLA DE SERVICIOS ---
	const tableBody = [
		[
			entry.description || "Servicio de Dermatología", // Concepto
			"1", // Cantidad
			formatCurrency(entry.amount), // Precio Unitario
			formatCurrency(entry.amount), // Total
		],
	];

	autoTable(doc, {
		startY: 85,
		head: [["Descripción", "Cant.", "Precio Unit.", "Total"]],
		body: tableBody,
		theme: "grid",
		headStyles: { fillColor: [225, 29, 72], textColor: 255, fontStyle: "bold" },
		columnStyles: {
			0: { cellWidth: "auto" }, // Descripción ancha
			1: { cellWidth: 20, halign: "center" },
			2: { cellWidth: 30, halign: "right" },
			3: { cellWidth: 30, halign: "right" },
		},
		styles: { fontSize: 10, cellPadding: 3 },
	});

	// --- 5. TOTALES ---
	const finalY = doc.lastAutoTable.finalY + 10;

	doc.setFontSize(12);
	doc.setFont("helvetica", "bold");
	doc.text(`TOTAL: ${formatCurrency(entry.amount)}`, pageWidth - 14, finalY, {
		align: "right",
	});

	doc.setFontSize(8);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(150);
	doc.text(
		"Servicio médico exento de IVA según Art. 20.Uno.3º Ley 37/1992",
		pageWidth - 14,
		finalY + 7,
		{ align: "right" },
	);

	// --- 6. PIE DE PÁGINA ---
	doc.setFontSize(8);
	doc.setTextColor(180);
	doc.text("Gracias por su confianza.", pageWidth / 2, 280, {
		align: "center",
	});

	// Guardar PDF
	doc.save(`Factura_${client.name}_${entry.date}.pdf`);
};
