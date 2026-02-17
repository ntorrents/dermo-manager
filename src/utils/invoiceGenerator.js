import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./format";

/**
 * Carga una imagen desde URL y la convierte a Base64 para jsPDF.
 * Evita problemas de CORS cargando vía Image + Canvas.
 */
const loadImageAsBase64 = (url) => {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0);
			try {
				resolve(canvas.toDataURL("image/png"));
			} catch (e) {
				reject(e);
			}
		};
		img.onerror = () => reject(new Error("Error al cargar imagen"));
		img.src = url;
	});
};

export const generateInvoice = async (entry, client, profile, logoUrl = null, options = {}) => {
	const isAbono = options.isAbono === true;
	let logoDataUrl = null;
	const logo = logoUrl || profile?.logo_url;
	if (logo && typeof logo === "string" && logo.startsWith("http")) {
		try {
			logoDataUrl = await loadImageAsBase64(logo);
		} catch {
			// Si falla (CORS, URL inválida, etc.), continuamos sin logo
		}
	}

	const doc = new jsPDF();
	const pageWidth = doc.internal.pageSize.width;

	// --- 1. CABECERA (Logo + Datos Fiscales Emisor) ---
	let y = 22;
	let hasLogo = false;

	if (logoDataUrl) {
		try {
			doc.addImage(logoDataUrl, "PNG", 14, 10, 35, 20);
			y = 38;
			hasLogo = true;
		} catch {
			// Si addImage falla, continuamos sin logo
		}
	}

	// Nombre Comercial (Grande y Rosa) - ajustado para no solapar con logo
	doc.setFontSize(18);
	doc.setTextColor(225, 29, 72); // Rose-600
	doc.text(profile?.company_name || profile?.companyName || "DermoApp", 14, y);
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
	const collegiate = profile?.collegiate_number || profile?.collegiateNumber;
	if (collegiate) {
		doc.text(`Nº Col: ${collegiate}`, 14, y);
		y += 5;
	}

	// Teléfono (Si existe)
	if (profile?.mobile) {
		doc.text(`Tel: ${profile.mobile}`, 14, y);
		y += 5;
	}

	// --- 2. DATOS DE LA FACTURA (Derecha Superior) ---
	let yRight = hasLogo ? 38 : 22;
	const rightColX = pageWidth - 14;

	const invoiceNum =
		entry.invoice_number ||
		`F-${entry.date.replace(/-/g, "")}-${(entry.id || "").slice(0, 4).toUpperCase()}`;

	doc.setFontSize(14);
	doc.setTextColor(0);
	doc.text(isAbono ? "ABONO" : "FACTURA", rightColX, yRight, { align: "right" });
	yRight += 8;

	doc.setFontSize(10);
	doc.setTextColor(100);
	doc.text(`Nº: ${invoiceNum}`, rightColX, yRight, { align: "right" });
	yRight += 5;
	doc.text(`Fecha: ${entry.date}`, rightColX, yRight, { align: "right" });

	// --- 3. DATOS DEL CLIENTE (Caja gris) — NIF obligatorio para facturación ---
	const boxStartY = Math.max(y + 10, 65);
	const boxHeight = client.address || client.nif ? 32 : 28;

	doc.setFillColor(249, 250, 251);
	doc.rect(14, boxStartY, pageWidth - 28, boxHeight, "F");

	doc.setFontSize(9);
	doc.setTextColor(156, 163, 175);
	doc.text("FACTURAR A:", 18, boxStartY + 8);

	doc.setFontSize(10);
	doc.setTextColor(0);

	const clientName = `${client.name || ""} ${client.surname || ""}`.trim();
	doc.text(clientName || "—", 18, boxStartY + 15);

	let clientLineY = boxStartY + 20;
	if (client.nif) {
		doc.setFontSize(9);
		doc.text(`NIF/CIF: ${client.nif}`, 18, clientLineY);
		clientLineY += 5;
	} else {
		doc.setFontSize(8);
		doc.setTextColor(120);
		doc.text("NIF/CIF: —", 18, clientLineY);
		clientLineY += 5;
		doc.setTextColor(0);
	}
	if (client.address) {
		doc.setFontSize(9);
		doc.text(client.address, 18, clientLineY);
	}

	// --- 4. TABLA DE SERVICIOS Y DESGLOSE IVA ---
	const tableStartY = boxStartY + boxHeight + 12;
	const totalAmount = Number(entry.total_amount ?? entry.amount ?? 0);
	const taxBase = Number(entry.tax_base);
	const taxAmount = Number(entry.tax_amount);
	const hasTax = entry.tax_rate > 0 && !Number.isNaN(taxBase) && !Number.isNaN(taxAmount);

	const tableBody = [
		[
			entry.description || (isAbono ? "Abono" : "Servicio de Dermatología"),
			"1",
			hasTax ? formatCurrency(taxBase) : formatCurrency(totalAmount),
			formatCurrency(totalAmount),
		],
	];

	autoTable(doc, {
		startY: tableStartY,
		head: [["Descripción", "Cant.", hasTax ? "P. Unit. (Base)" : "Precio Unit.", "Total"]],
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

	let finalY = doc.lastAutoTable.finalY + 10;

	if (hasTax) {
		doc.setFontSize(9);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(80);
		doc.text(`Base imponible: ${formatCurrency(taxBase)}`, pageWidth - 14, finalY, {
			align: "right",
		});
		finalY += 6;
		doc.text(`Cuota IVA (${entry.tax_rate || 21}%): ${formatCurrency(taxAmount)}`, pageWidth - 14, finalY, {
			align: "right",
		});
		finalY += 6;
	}

	doc.setFontSize(12);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(0);
	doc.text(`TOTAL: ${formatCurrency(totalAmount)}`, pageWidth - 14, finalY, {
		align: "right",
	});
	finalY += 8;

	doc.setFontSize(8);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(150);
	if (isAbono) {
		doc.text(
			"Factura rectificativa. Ley 37/1992.",
			pageWidth - 14,
			finalY,
			{ align: "right" },
		);
	} else if (hasTax) {
		doc.text(
			"Factura sujeta y no exenta. Ley 37/1992.",
			pageWidth - 14,
			finalY,
			{ align: "right" },
		);
	} else {
		doc.text(
			"Servicio médico exento de IVA según Art. 20.Uno.3º Ley 37/1992",
			pageWidth - 14,
			finalY,
			{ align: "right" },
		);
	}

	// --- 5. PLACEHOLDER QR VERIFACTU ---
	const qrSize = 28;
	const qrX = 14;
	const qrY = 265;
	doc.setDrawColor(200, 200, 200);
	doc.setLineWidth(0.5);
	doc.rect(qrX, qrY, qrSize, qrSize);
	doc.setFontSize(6);
	doc.setTextColor(180);
	doc.text("QR Verifactu", qrX + qrSize / 2, qrY + qrSize / 2 - 2, { align: "center" });
	doc.text("(placeholder)", qrX + qrSize / 2, qrY + qrSize / 2 + 3, { align: "center" });

	// --- 6. PIE DE PÁGINA ---
	doc.setFontSize(8);
	doc.setTextColor(180);
	doc.text("Gracias por su confianza.", pageWidth / 2, 280, {
		align: "center",
	});

	// Guardar PDF
	const safeName = clientName.replace(/[^a-z0-9]/gi, "_");
	doc.save(isAbono ? `Abono_${entry.invoice_number || "R"}_${safeName}.pdf` : `Factura_${safeName}_${entry.date}.pdf`);
};
