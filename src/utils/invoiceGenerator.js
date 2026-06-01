import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Importes para PDF: guión ASCII, coma decimal, espacio normal (sin Intl / U+2212). */
const formatEuroPdf = (amount) => {
	const n = Math.round((Number(amount) || 0) * 100) / 100;
	const abs = Math.abs(n);
	const str =
		abs % 1 === 0 ? String(Math.round(abs)) : abs.toFixed(2).replace(".", ",");
	return `${n < 0 ? "-" : ""}${str} \u20AC`;
};

/** Activar cuando integremos Verifactu (QR en factura). */
const ENABLE_VERIFACTU_QR = false;

const MARGIN = 14;
const LOGO_MAX_WIDTH = 42;
const LOGO_MAX_HEIGHT = 28;

/**
 * Carga imagen desde URL → base64 + dimensiones naturales (para respetar proporción).
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
				resolve({
					dataUrl: canvas.toDataURL("image/png"),
					width: img.naturalWidth,
					height: img.naturalHeight,
				});
			} catch (e) {
				reject(e);
			}
		};
		img.onerror = () => reject(new Error("Error al cargar imagen"));
		img.src = url;
	});
};

/** Escala imagen dentro de maxW × maxH manteniendo relación de aspecto. */
const fitImageDimensions = (naturalW, naturalH, maxW, maxH) => {
	if (!naturalW || !naturalH) return { width: maxW, height: maxH };
	const ratio = naturalW / naturalH;
	let width = maxW;
	let height = width / ratio;
	if (height > maxH) {
		height = maxH;
		width = height * ratio;
	}
	return { width, height };
};

/** Bloque de totales alineado a la derecha, sin desbordar márgenes. */
const drawTotalsBlock = (doc, pageWidth, startY, lines, totalLine) => {
	const blockWidth = 88;
	const blockX = pageWidth - MARGIN - blockWidth;
	const rightX = pageWidth - MARGIN;
	let y = startY;

	doc.setDrawColor(230, 230, 230);
	doc.setFillColor(252, 252, 253);
	const blockHeight = lines.length * 6 + 10 + (totalLine ? 8 : 0);
	doc.roundedRect(blockX, y - 4, blockWidth, blockHeight, 2, 2, "FD");

	lines.forEach(({ label, value, muted }) => {
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.setTextColor(muted ? 100 : 60);
		doc.text(label, blockX + 4, y);
		doc.text(value, rightX - 4, y, { align: "right" });
		y += 6;
	});

	if (totalLine) {
		y += 2;
		doc.setDrawColor(225, 29, 72);
		doc.setLineWidth(0.3);
		doc.line(blockX + 4, y - 2, rightX - 4, y - 2);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(11);
		doc.setTextColor(0);
		doc.text(totalLine.label, blockX + 4, y + 4);
		doc.text(totalLine.value, rightX - 4, y + 4, { align: "right" });
		y += 10;
	}

	return y;
};

/** Pie legal con ancho máximo (evita texto cortado a la derecha). */
const drawLegalFooter = (doc, pageWidth, y, text) => {
	const maxW = pageWidth - MARGIN * 2;
	doc.setFontSize(7.5);
	doc.setFont("helvetica", "italic");
	doc.setTextColor(130);
	const wrapped = doc.splitTextToSize(text, maxW);
	doc.text(wrapped, pageWidth / 2, y, { align: "center" });
	return y + wrapped.length * 3.5;
};

/**
 * Placeholder QR Verifactu (desactivado por defecto).
 * @see ENABLE_VERIFACTU_QR
 */
const drawVerifactuQrPlaceholder = (doc) => {
	if (!ENABLE_VERIFACTU_QR) return;
	const qrSize = 28;
	const qrX = MARGIN;
	const qrY = 265;
	doc.setDrawColor(200, 200, 200);
	doc.setLineWidth(0.5);
	doc.rect(qrX, qrY, qrSize, qrSize);
	doc.setFontSize(6);
	doc.setTextColor(180);
	doc.text("QR Verifactu", qrX + qrSize / 2, qrY + qrSize / 2 - 2, { align: "center" });
	doc.text("(pendiente)", qrX + qrSize / 2, qrY + qrSize / 2 + 3, { align: "center" });
};

export const generateInvoice = async (entry, client, clinic, profile, options = {}) => {
	const isAbono = options.isAbono === true;
	let logoAsset = null;
	const logo = clinic?.logo_url || profile?.logo_url;
	if (logo && typeof logo === "string" && logo.startsWith("http")) {
		try {
			logoAsset = await loadImageAsBase64(logo);
		} catch {
			// Sin logo si falla CORS o URL
		}
	}

	const doc = new jsPDF();
	const pageWidth = doc.internal.pageSize.width;

	// --- 1. CABECERA ---
	let y = 20;
	let hasLogo = false;
	let logoBottomY = 10;

	if (logoAsset?.dataUrl) {
		try {
			const { width, height } = fitImageDimensions(
				logoAsset.width,
				logoAsset.height,
				LOGO_MAX_WIDTH,
				LOGO_MAX_HEIGHT,
			);
			doc.addImage(logoAsset.dataUrl, "PNG", MARGIN, 12, width, height);
			hasLogo = true;
			logoBottomY = 12 + height + 4;
			y = Math.max(y, logoBottomY);
		} catch {
			// addImage falló
		}
	}

	doc.setFontSize(16);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(225, 29, 72);
	const clinicName =
		clinic?.name || profile?.company_name || profile?.companyName || "DermoApp";
	doc.text(clinicName, MARGIN, hasLogo ? logoBottomY + 6 : y);
	y = (hasLogo ? logoBottomY + 6 : y) + 7;

	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(80);

	const drName = profile?.name
		? `${profile.name} ${profile.surname || ""}`.trim()
		: "";
	const emitterLines = [];
	if (drName) emitterLines.push(drName);
	if (clinic?.billing_nif || profile?.nif) {
		emitterLines.push(`NIF/CIF: ${clinic?.billing_nif || profile?.nif}`);
	}
	if (clinic?.billing_address || profile?.address) {
		emitterLines.push(clinic?.billing_address || profile?.address);
	}
	if (clinic?.billing_city || profile?.city) {
		emitterLines.push(clinic?.billing_city || profile?.city);
	}
	const collegiate = profile?.collegiate_number || profile?.collegiateNumber;
	if (collegiate) emitterLines.push(`Nº colegiado: ${collegiate}`);
	if (clinic?.billing_phone || profile?.mobile) {
		emitterLines.push(`Tel.: ${clinic?.billing_phone || profile?.mobile}`);
	}
	const email = clinic?.billing_email || profile?.email;
	if (email) emitterLines.push(email);

	emitterLines.forEach((line) => {
		doc.text(line, MARGIN, y);
		y += 4.5;
	});

	// --- 2. FACTURA (derecha) ---
	let yRight = 18;
	const rightColX = pageWidth - MARGIN;

	const invoiceNum =
		entry.invoice_number ||
		`F-${entry.date.replace(/-/g, "")}-${(entry.id || "").slice(0, 4).toUpperCase()}`;

	doc.setFontSize(16);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(30);
	doc.text(isAbono ? "ABONO" : "FACTURA", rightColX, yRight, { align: "right" });
	yRight += 9;

	doc.setFontSize(10);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(90);
	doc.text(`Nº ${invoiceNum}`, rightColX, yRight, { align: "right" });
	yRight += 5;
	doc.text(`Fecha: ${entry.date}`, rightColX, yRight, { align: "right" });

	// --- 3. CLIENTE ---
	const boxStartY = Math.max(y + 8, 58);
	const clientHasExtra = !!(client.address || client.nif);
	const boxHeight = clientHasExtra ? 30 : 24;

	doc.setFillColor(248, 250, 252);
	doc.setDrawColor(229, 231, 235);
	doc.roundedRect(MARGIN, boxStartY, pageWidth - MARGIN * 2, boxHeight, 2, 2, "FD");

	doc.setFontSize(8);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(156, 163, 175);
	doc.text("FACTURAR A", MARGIN + 4, boxStartY + 7);

	doc.setFontSize(10);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(30);
	const clientName = `${client.name || ""} ${client.surname || ""}`.trim();
	doc.text(clientName || "—", MARGIN + 4, boxStartY + 14);

	doc.setFont("helvetica", "normal");
	doc.setFontSize(9);
	let clientLineY = boxStartY + 20;
	if (client.nif) {
		doc.text(`NIF/CIF: ${client.nif}`, MARGIN + 4, clientLineY);
		clientLineY += 5;
	}
	if (client.address?.trim()) {
		const addrLines = doc.splitTextToSize(client.address.trim(), pageWidth - MARGIN * 2 - 8);
		addrLines.forEach((line) => {
			doc.text(line, MARGIN + 4, clientLineY);
			clientLineY += 4.5;
		});
	} else if (client.is_company) {
		doc.setFontSize(8);
		doc.setTextColor(180, 100, 0);
		doc.text("Dirección fiscal: pendiente en ficha de cliente", MARGIN + 4, clientLineY);
		doc.setFontSize(9);
		doc.setTextColor(30);
	}

	// --- 4. LÍNEAS ---
	const tableStartY = boxStartY + boxHeight + 10;
	const totalAmount = Number(entry.total_amount ?? entry.amount ?? 0);
	const taxBase = Number(entry.tax_base);
	const taxAmount = Number(entry.tax_amount);
	const hasTax = entry.tax_rate > 0 && !Number.isNaN(taxBase) && !Number.isNaN(taxAmount);
	const showUnitBase = (!Number.isNaN(taxBase) && taxBase > 0) || hasTax;
	const irpfAmount = Number(entry.irpf_amount) || 0;
	const irpfRate = Number(entry.irpf_rate) || 0;
	const hasIrpf = irpfAmount > 0 && irpfRate > 0;

	const lineBase = showUnitBase ? taxBase : totalAmount;
	const lineImporte = lineBase;

	const tableBody = [
		[
			entry.description || (isAbono ? "Abono" : "Servicio"),
			"1",
			showUnitBase ? formatEuroPdf(lineBase) : formatEuroPdf(totalAmount),
			formatEuroPdf(lineImporte),
		],
	];

	autoTable(doc, {
		startY: tableStartY,
		margin: { left: MARGIN, right: MARGIN },
		head: [
			["Descripción", "Cant.", showUnitBase ? "P. unitario" : "Precio", "Importe"],
		],
		body: tableBody,
		theme: "striped",
		headStyles: {
			fillColor: [225, 29, 72],
			textColor: 255,
			fontStyle: "bold",
			fontSize: 9,
		},
		columnStyles: {
			0: { cellWidth: "auto" },
			1: { cellWidth: 18, halign: "center" },
			2: { cellWidth: 32, halign: "right" },
			3: { cellWidth: 32, halign: "right" },
		},
		styles: { fontSize: 9, cellPadding: 3.5, overflow: "linebreak" },
	});

	let finalY = doc.lastAutoTable.finalY + 12;

	const totalLines = [];
	if (showUnitBase || taxBase > 0) {
		totalLines.push({
			label: "Base imponible",
			value: formatEuroPdf(taxBase),
		});
	}
	if (hasTax) {
		totalLines.push({
			label: `IVA (${entry.tax_rate || 21}%)`,
			value: formatEuroPdf(taxAmount),
		});
	}
	if (hasIrpf) {
		totalLines.push({
			label: `Retención IRPF (${irpfRate}%)`,
			value: formatEuroPdf(-irpfAmount),
		});
	}

	finalY = drawTotalsBlock(doc, pageWidth, finalY, totalLines, {
		label: "Total a pagar",
		value: formatEuroPdf(totalAmount),
	});

	let legalY = finalY + 6;
	let legalText;
	if (isAbono) {
		legalText =
			"Factura rectificativa (abono) conforme a la Ley 37/1992, del Impuesto sobre el Valor Añadido.";
	} else if (hasTax) {
		legalText =
			"Factura sujeta y no exenta conforme a la Ley 37/1992, del Impuesto sobre el Valor Añadido.";
	} else {
		legalText =
			"Operación exenta de IVA por tratamiento sanitario (art. 20.Uno.3.º Ley 37/1992).";
	}
	legalY = drawLegalFooter(doc, pageWidth, legalY, legalText);

	drawVerifactuQrPlaceholder(doc);

	const safeName = (clientName || "cliente").replace(/[^a-z0-9]/gi, "_");
	doc.save(
		isAbono
			? `Abono_${entry.invoice_number || "R"}_${safeName}.pdf`
			: `Factura_${invoiceNum}_${safeName}.pdf`,
	);
};
