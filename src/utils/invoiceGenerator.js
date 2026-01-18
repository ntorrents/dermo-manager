import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./format";

export const generateInvoice = (entry, client, profile) => {
	const doc = new jsPDF();
	const pageWidth = doc.internal.pageSize.width;

	// --- 1. CABECERA (Datos Fiscales Emisor) ---
	// Usamos una variable 'y' que irá bajando para que no se solapen los textos
	let y = 22;

	// Nombre Comercial (Grande y Rosa)
	doc.setFontSize(18);
	doc.setTextColor(225, 29, 72); // Rose-600
	doc.text(profile?.companyName || "DermoApp", 14, y);
	y += 8; // Bajamos 8 puntos

	// Datos Fiscales (Pequeño y Gris Oscuro)
	doc.setFontSize(9);
	doc.setTextColor(80);

	// Nombre Profesional
	const drName = profile?.name
		? `${profile.name} ${profile.surname || ""}`
		: "";
	if (drName) {
		doc.text(drName, 14, y);
		y += 5;
	}

	// NIF / CIF (Nuevo)
	if (profile?.nif) {
		doc.text(`NIF/CIF: ${profile.nif}`, 14, y);
		y += 5;
	}

	// Dirección (Nuevo)
	if (profile?.address) {
		doc.text(profile.address, 14, y);
		y += 5;
	}

	// Ciudad / CP (Nuevo)
	if (profile?.city) {
		doc.text(profile.city, 14, y);
		y += 5;
	}

	// Nº Colegiado (Si existe)
	if (profile?.collegiateNumber) {
		doc.text(`Nº Col: ${profile.collegiateNumber}`, 14, y);
		y += 5;
	}

	// Teléfono (Si existe)
	if (profile?.mobile) {
		doc.text(`Tel: ${profile.mobile}`, 14, y);
		y += 5;
	}

	// --- 2. DATOS DE LA FACTURA (Derecha Superior) ---
	// La parte derecha siempre empieza arriba, independientemente de la izquierda
	let yRight = 22;
	const rightColX = pageWidth - 14;

	const invoiceNum = `F-${entry.date.replace(/-/g, "")}-${entry.id.slice(0, 4).toUpperCase()}`;

	doc.setFontSize(14);
	doc.setTextColor(0);
	doc.text("FACTURA", rightColX, yRight, { align: "right" });
	yRight += 8;

	doc.setFontSize(10);
	doc.setTextColor(100);
	doc.text(`Nº: ${invoiceNum}`, rightColX, yRight, { align: "right" });
	yRight += 5;
	doc.text(`Fecha: ${entry.date}`, rightColX, yRight, { align: "right" });

	// --- 3. DATOS DEL CLIENTE (Caja gris) ---
	// Calculamos dónde debe empezar la caja del cliente.
	// Debe ser debajo de los datos de la empresa, pero mínimo en la posición 65 para que no quede muy pegado arriba.
	const boxStartY = Math.max(y + 10, 65);

	doc.setFillColor(249, 250, 251); // Gray-50
	doc.rect(14, boxStartY, pageWidth - 28, 25, "F");

	doc.setFontSize(9);
	doc.setTextColor(156, 163, 175); // Gray-400
	doc.text("FACTURAR A:", 18, boxStartY + 8);

	doc.setFontSize(10);
	doc.setTextColor(0);

	// Nombre Cliente
	const clientName = `${client.name} ${client.surname || ""}`;
	doc.text(clientName, 18, boxStartY + 15);

	// Dirección Cliente (Si la tuviéramos en el futuro)
	if (client.address) {
		doc.text(client.address, 18, boxStartY + 20);
	}

	// --- 4. TABLA DE SERVICIOS ---
	// La tabla empieza 15 puntos por debajo de la caja del cliente
	const tableStartY = boxStartY + 35;

	const tableBody = [
		[
			entry.description || "Servicio de Dermatología",
			"1",
			formatCurrency(entry.amount),
			formatCurrency(entry.amount),
		],
	];

	autoTable(doc, {
		startY: tableStartY,
		head: [["Descripción", "Cant.", "Precio Unit.", "Total"]],
		body: tableBody,
		theme: "grid",
		headStyles: { fillColor: [225, 29, 72], textColor: 255, fontStyle: "bold" },
		columnStyles: {
			0: { cellWidth: "auto" },
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
	doc.setTextColor(0);
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
	const safeName = clientName.replace(/[^a-z0-9]/gi, "_");
	doc.save(`Factura_${safeName}_${entry.date}.pdf`);
};
