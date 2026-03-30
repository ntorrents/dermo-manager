import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./format";

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

const lineTotals = (qty, unitTtc, taxRate) => {
	const q = Number(qty) || 0;
	const ttcUnit = Number(unitTtc) || 0;
	const rate = Number(taxRate) || 0;
	const lineTtc = q * ttcUnit;
	const lineBase = rate > 0 ? lineTtc / (1 + rate / 100) : lineTtc;
	const lineTax = lineTtc - lineBase;
	return { lineTtc, lineBase, lineTax };
};

const safeNum = (v) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
};

/**
 * PDF de presupuesto (sin numeración fiscal ni QR VeriFactu).
 * @param {object} client
 * @param {object} profile - datos de facturación
 * @param {object} presupuesto - { notas, valid_until, created_at, id }
 * @param {Array<{ description, quantity, unit_price_ttc, tax_rate }>} lineas
 */
export const generateBudgetPDF = async (client, profile, presupuesto, lineas = []) => {
	let logoDataUrl = null;
	const logo = profile?.logo_url;
	if (logo && typeof logo === "string" && logo.startsWith("http")) {
		try {
			logoDataUrl = await loadImageAsBase64(logo);
		} catch {
			/* sin logo */
		}
	}

	const doc = new jsPDF();
	const pageWidth = doc.internal.pageSize.width;

	let y = 22;
	let hasLogo = false;
	if (logoDataUrl) {
		try {
			doc.addImage(logoDataUrl, "PNG", 14, 10, 35, 20);
			y = 38;
			hasLogo = true;
		} catch {
			/* */
		}
	}

	doc.setFontSize(18);
	doc.setTextColor(225, 29, 72);
	doc.text(profile?.company_name || profile?.companyName || "DermoApp", 14, y);
	y += 8;

	doc.setFontSize(9);
	doc.setTextColor(80);
	const drName = profile?.name ? `${profile.name} ${profile.surname || ""}` : "";
	if (drName) {
		doc.text(drName, 14, y);
		y += 5;
	}
	if (profile?.nif) {
		doc.text(`NIF/CIF: ${profile.nif}`, 14, y);
		y += 5;
	}
	if (profile?.address) {
		doc.text(profile.address, 14, y);
		y += 5;
	}
	if (profile?.city) {
		doc.text(profile.city, 14, y);
		y += 5;
	}

	let yRight = hasLogo ? 38 : 22;
	const rightColX = pageWidth - 14;
	doc.setFontSize(14);
	doc.setTextColor(0);
	doc.text("PRESUPUESTO", rightColX, yRight, { align: "right" });
	yRight += 8;
	doc.setFontSize(10);
	doc.setTextColor(100);
	const presDate = presupuesto?.created_at
		? new Date(presupuesto.created_at).toLocaleDateString("es-ES")
		: new Date().toLocaleDateString("es-ES");
	doc.text(`Fecha: ${presDate}`, rightColX, yRight, { align: "right" });
	yRight += 5;
	if (presupuesto?.valid_until) {
		doc.text(`Válido hasta: ${presupuesto.valid_until}`, rightColX, yRight, { align: "right" });
		yRight += 5;
	}
	if (presupuesto?.nombre) {
		doc.text(String(presupuesto.nombre).slice(0, 48), rightColX, yRight, { align: "right" });
	}

	const boxStartY = Math.max(y + 10, 65);
	const boxHeight = client?.address || client?.nif ? 32 : 28;
	doc.setFillColor(249, 250, 251);
	doc.rect(14, boxStartY, pageWidth - 28, boxHeight, "F");
	doc.setFontSize(9);
	doc.setTextColor(156, 163, 175);
	doc.text("CLIENTE:", 18, boxStartY + 8);
	doc.setFontSize(10);
	doc.setTextColor(0);
	const clientName = `${client?.name || ""} ${client?.surname || ""}`.trim();
	doc.text(clientName || "—", 18, boxStartY + 15);
	let clientLineY = boxStartY + 20;
	if (client?.nif) {
		doc.setFontSize(9);
		doc.text(`NIF/CIF: ${client.nif}`, 18, clientLineY);
		clientLineY += 5;
	}
	if (client?.address) {
		doc.text(client.address, 18, clientLineY);
	}

	const tableStartY = boxStartY + boxHeight + 12;
	let sumBase = 0;
	let sumTax = 0;
	let sumTtc = 0;
	let sumOriginalTtc = 0;

	const tableBody = (lineas || []).map((ln) => {
		const originalUnit = safeNum(ln.original_unit_price_ttc);
		const appliedUnit = safeNum(ln.unit_price_ttc) ?? 0;
		const qty = safeNum(ln.quantity) ?? 0;

		const { lineTtc, lineBase, lineTax } = lineTotals(
			qty,
			appliedUnit,
			ln.tax_rate,
		);
		sumBase += lineBase;
		sumTax += lineTax;
		sumTtc += lineTtc;
		if (originalUnit != null) sumOriginalTtc += qty * originalUnit;
		else sumOriginalTtc += qty * appliedUnit;

		const lineOriginalTtc = (originalUnit != null ? originalUnit : appliedUnit) * qty;
		const discountLine = Math.max(0, lineOriginalTtc - lineTtc);
		return [
			ln.description || "—",
			String(qty || 0),
			formatCurrency(originalUnit != null ? originalUnit : appliedUnit),
			formatCurrency(discountLine),
			formatCurrency(appliedUnit),
			`${Number(ln.tax_rate) || 0}%`,
			formatCurrency(lineTtc),
		];
	});

	autoTable(doc, {
		startY: tableStartY,
		head: [["Concepto", "Cant.", "PVP", "DTO", "Aplicado", "IVA %", "Total"]],
		body: tableBody.length ? tableBody : [["Sin líneas", "—", "—", "—", "—", "—", "—"]],
		theme: "grid",
		headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: "bold" },
		columnStyles: {
			0: { cellWidth: "44" },
			1: { halign: "center" },
			2: { halign: "right" },
			3: { halign: "right" },
			4: { halign: "right" },
			5: { halign: "center" },
			6: { halign: "right" },
		},
		styles: { fontSize: 9, cellPadding: 3 },
	});

	let finalY = doc.lastAutoTable.finalY + 10;
	const totalDiscount = Math.max(0, sumOriginalTtc - sumTtc);
	if (tableBody.length && totalDiscount > 0) {
		doc.setFontSize(9);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(80);
		const pct = safeNum(presupuesto?.discount_percent);
		const label = pct != null ? `Descuento total (${pct}%): ${formatCurrency(totalDiscount)}` : `Descuento total: ${formatCurrency(totalDiscount)}`;
		doc.text(label, pageWidth - 14, finalY, { align: "right" });
		finalY += 6;
	}
	if (tableBody.length && sumTtc > 0) {
		doc.setFontSize(9);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(80);
		doc.text(`Base imponible: ${formatCurrency(sumBase)}`, pageWidth - 14, finalY, {
			align: "right",
		});
		finalY += 6;
		doc.text(`Cuota IVA: ${formatCurrency(sumTax)}`, pageWidth - 14, finalY, { align: "right" });
		finalY += 6;
	}
	doc.setFontSize(12);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(0);
	doc.text(`TOTAL: ${formatCurrency(sumTtc)}`, pageWidth - 14, finalY, { align: "right" });
	finalY += 10;

	if (presupuesto?.notas) {
		doc.setFontSize(9);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(60);
		const split = doc.splitTextToSize(String(presupuesto.notas), pageWidth - 28);
		doc.text(split, 14, finalY);
		finalY += split.length * 5 + 6;
	}

	doc.setFontSize(8);
	doc.setTextColor(120);
	doc.text(
		"Documento sin validez fiscal. Presupuesto informativo; no sustituye factura.",
		pageWidth / 2,
		Math.min(finalY + 8, 275),
		{ align: "center" },
	);

	const safe = (clientName || "cliente").replace(/[^a-z0-9]/gi, "_");
	const idBit = (presupuesto?.id || "").toString().slice(0, 8);
	doc.save(`Presupuesto_${safe}_${idBit || presDate.replace(/\//g, "-")}.pdf`);
};

export const sumBudgetLinesTTC = (lineas = []) =>
	lineas.reduce((acc, ln) => acc + lineTotals(ln.quantity, ln.unit_price_ttc, ln.tax_rate).lineTtc, 0);

export const sumBudgetLinesOriginalTTC = (lineas = []) =>
	(lineas || []).reduce((acc, ln) => {
		const q = Number(ln.quantity) || 0;
		const original = ln.original_unit_price_ttc != null ? Number(ln.original_unit_price_ttc) : Number(ln.unit_price_ttc) || 0;
		return acc + q * original;
	}, 0);
