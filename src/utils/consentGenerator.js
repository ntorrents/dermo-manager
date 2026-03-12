import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getAge } from "./dateUtils";

/**
 * CABECERA Y PIE DEL PDF DE CONSENTIMIENTO
 * - Cabecera: logo (modal o Ajustes → logo), nombre clínica (Ajustes → Nombre Comercial),
 *   profesional (Ajustes → Nombre, Apellidos, Nº Colegiado), título "CONSENTIMIENTO INFORMADO",
 *   y bloque de datos del paciente (abajo).
 * - Bloque de datos del paciente: Paciente, Fecha de nacimiento, Correo electrónico, NIF/CIF,
 *   Tratamiento, Fecha. Para añadir o quitar líneas, editar el bloque "Bloque de datos del paciente"
 *   en generateConsentPDF en este archivo.
 * - Pie: imagen de firma (opcional), línea y texto "Firma del paciente".
 */
const MARGIN = 20;
const PAGE_WIDTH = 210;
const LINE_HEIGHT = 6;
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** Ancho del contenido HTML en px (equivalente a ~170mm a 96dpi) para renderizar antes de meter en PDF */
const HTML_CONTENT_WIDTH_PX = 640;
const HTML2CANVAS_SCALE = 2;
const LOGO_MAX_WIDTH_MM = 45;
const LOGO_MAX_HEIGHT_MM = 18;
const SIGNATURE_MAX_WIDTH_MM = 40;
const SIGNATURE_MAX_HEIGHT_MM = 12;

/** Lista de variables disponibles para documentación en UI */
export const CONSENT_VARIABLES = [
	"{{NOMBRE}}",
	"{{APELLIDOS}}",
	"{{TELEFONO}}",
	"{{EMAIL}}",
	"{{DNI}}",
	"{{NIF}}",
	"{{FECHA_NACIMIENTO}}",
	"{{EDAD}}",
	"{{ORIGEN}}",
	"{{NOTAS}}",
	"{{TRATAMIENTO}}",
	"{{FECHA}}",
];

/**
 * Escapa y divide el texto en líneas que caben en el ancho dado.
 */
const wrapText = (doc, text, maxWidth = MAX_WIDTH) => {
	const lines = doc.splitTextToSize(text || "", maxWidth);
	return Array.isArray(lines) ? lines : [lines];
};

/**
 * Reemplaza variables en el contenido de la plantilla (texto o HTML).
 * Paciente: NOMBRE, APELLIDOS, TELEFONO, EMAIL, DNI, NIF, FECHA_NACIMIENTO, EDAD, ORIGEN, NOTAS.
 * Contexto: TRATAMIENTO, FECHA (fecha actual).
 */
export const replaceConsentVariables = (content, client, treatmentName = "") => {
	const nombre = client?.name ?? "";
	const apellidos = client?.surname ?? "";
	const telefono = client?.phone ?? "";
	const email = client?.email ?? "";
	const dni = client?.nif ?? client?.dni ?? "";
	const nif = client?.nif ?? "";
	const fechaNac = client?.fecha_nacimiento ?? "";
	const edad = fechaNac ? String(getAge(fechaNac) ?? "") : "";
	const origen = client?.origin ?? "";
	const notas = client?.notes ?? "";
	const fecha = new Date().toLocaleDateString("es-ES", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});

	let out = content || "";
	out = out.replace(/\{\{NOMBRE\}\}/gi, nombre);
	out = out.replace(/\{\{APELLIDOS\}\}/gi, apellidos);
	out = out.replace(/\{\{TELEFONO\}\}/gi, telefono);
	out = out.replace(/\{\{EMAIL\}\}/gi, email);
	out = out.replace(/\{\{DNI\}\}/gi, dni);
	out = out.replace(/\{\{NIF\}\}/gi, nif);
	out = out.replace(/\{\{FECHA_NACIMIENTO\}\}/gi, fechaNac);
	out = out.replace(/\{\{EDAD\}\}/gi, edad);
	out = out.replace(/\{\{ORIGEN\}\}/gi, origen);
	out = out.replace(/\{\{NOTAS\}\}/gi, notas);
	out = out.replace(/\{\{TRATAMIENTO\}\}/gi, treatmentName);
	out = out.replace(/\{\{FECHA\}\}/gi, fecha);
	return out;
};

/**
 * Convierte HTML a texto plano conservando párrafos y saltos de línea (fallback cuando no hay DOM).
 */
const htmlToPlainText = (html) => {
	if (!html || !html.trim()) return "";
	const div = typeof document !== "undefined" ? document.createElement("div") : null;
	if (!div) return String(html).replace(/<[^>]+>/g, " ");
	div.innerHTML = html;
	const text = div.innerText || div.textContent || "";
	return text.replace(/\s+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
};

const isHTML = (str) => typeof str === "string" && /<[a-z][\s\S]*>/i.test(str);

/**
 * Carga una imagen desde data URL y devuelve dimensiones en mm para encajar en maxW x maxH.
 * @returns {Promise<{ dataUrl: string, widthMm: number, heightMm: number } | null>}
 */
/** Aproximación: 1px ≈ 0.264583 mm a 96dpi */
const pxToMm = (px) => px * 0.264583;

const loadImageForPDF = (dataUrl, maxWidthMm, maxHeightMm) => {
	if (!dataUrl || typeof document === "undefined") return Promise.resolve(null);
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const w = img.naturalWidth || 1;
			const h = img.naturalHeight || 1;
			let widthMm = pxToMm(w);
			let heightMm = pxToMm(h);
			const scale = Math.min(1, maxWidthMm / widthMm, maxHeightMm / heightMm);
			widthMm *= scale;
			heightMm *= scale;
			resolve({ dataUrl, widthMm, heightMm, format: getImageFormat(dataUrl) });
		};
		img.onerror = () => resolve(null);
		img.src = dataUrl;
	});
};

/** CSS para que los párrafos y listas tengan espacio (doble salto visual) en el PDF */
const CONSENT_CONTENT_STYLES = `
.consent-content p { margin: 0 0 0.75em 0; }
.consent-content p:last-child { margin-bottom: 0; }
.consent-content ul, .consent-content ol { margin: 0.5em 0 0.75em 0; padding-left: 1.5em; }
.consent-content li { margin-bottom: 0.25em; }
.consent-content h1, .consent-content h2, .consent-content h3 { margin: 0.6em 0 0.35em 0; }
`;

/**
 * Renderiza HTML en un div temporal y lo convierte a canvas con html2canvas.
 * El div se monta fuera de pantalla y se elimina después.
 * Aplica estilos para separación entre párrafos (doble salto).
 */
const renderHTMLToCanvas = (html) => {
	if (typeof document === "undefined") return Promise.resolve(null);
	const wrap = document.createElement("div");
	wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:" + HTML_CONTENT_WIDTH_PX + "px;box-sizing:border-box;padding:12px;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;color:#000;background:#fff;";
	wrap.innerHTML = "<style>" + CONSENT_CONTENT_STYLES + "</style><div class=\"consent-content\">" + (html || "") + "</div>";
	document.body.appendChild(wrap);
	return html2canvas(wrap, {
		scale: HTML2CANVAS_SCALE,
		useCORS: true,
		allowTaint: true,
		logging: false,
	}).then((canvas) => {
		document.body.removeChild(wrap);
		return canvas;
	}).catch((err) => {
		if (document.body.contains(wrap)) document.body.removeChild(wrap);
		console.warn("html2canvas error", err);
		return null;
	});
};

/**
 * Añade el canvas del contenido al PDF, repartiendo en varias páginas si hace falta.
 */
const addContentCanvasToPDF = (doc, canvas, startY) => {
	const pageHeight = doc.internal.pageSize.height;
	const contentWidthMm = MAX_WIDTH;
	const maxYPerPage = pageHeight - MARGIN - 25;
	const mmToPx = canvas.width / contentWidthMm;
	let y = startY;
	let sourceY = 0;
	let remainingPx = canvas.height;
	let firstPage = true;
	while (remainingPx > 0) {
		const availableMm = firstPage ? (maxYPerPage - startY) : (maxYPerPage - MARGIN);
		const slicePx = Math.min(remainingPx, Math.ceil(availableMm * mmToPx));
		const sliceCanvas = document.createElement("canvas");
		sliceCanvas.width = canvas.width;
		sliceCanvas.height = slicePx;
		const ctx = sliceCanvas.getContext("2d");
		ctx.drawImage(canvas, 0, sourceY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
		const imgData = sliceCanvas.toDataURL("image/png");
		const sliceHeightMm = (slicePx / canvas.width) * contentWidthMm;
		doc.addImage(imgData, "PNG", MARGIN, y, contentWidthMm, sliceHeightMm);
		sourceY += slicePx;
		remainingPx -= slicePx;
		if (remainingPx > 0) {
			doc.addPage();
			y = MARGIN;
			firstPage = false;
		} else {
			y += sliceHeightMm;
		}
	}
	return y;
};

/**
 * Intenta cargar una imagen desde URL y devolverla como data URL (para logo de perfil).
 * Solo devuelve si el contenido es realmente una imagen; si es HTML/error, devuelve null.
 * Puede fallar por CORS; en ese caso devuelve null.
 */
const fetchImageAsDataUrl = (url) => {
	if (!url || typeof fetch === "undefined") return Promise.resolve(null);
	return fetch(url, { mode: "cors" })
		.then((r) => {
			if (!r.ok) return null;
			return r.blob();
		})
		.then((blob) => {
			if (!blob || !blob.type.startsWith("image/")) return null;
			return new Promise((resolve, reject) => {
				const r = new FileReader();
				r.onload = () => resolve(r.result);
				r.onerror = reject;
				r.readAsDataURL(blob);
			});
		})
		.catch(() => null);
};

/** Detecta formato según el data URL (solo para decidir si mantener o reconvertir). */
const getImageFormat = (dataUrl) => {
	if (!dataUrl || typeof dataUrl !== "string") return "PNG";
	const s = dataUrl.slice(0, 30).toLowerCase();
	if (s.indexOf("data:image/jpeg") === 0 || s.indexOf("data:image/jpg") === 0) return "JPEG";
	return "PNG";
};

/**
 * Convierte cualquier imagen (data URL) a formato que jsPDF acepta: JPEG se mantiene,
 * el resto (PNG, WebP, etc.) se redibuja a canvas y se exporta como PNG para evitar "wrong PNG signature".
 * @returns {Promise<{ dataUrl: string, format: "PNG" | "JPEG" }>}
 */
const normalizeImageForJsPDF = (dataUrl) => {
	if (!dataUrl || typeof document === "undefined") return Promise.resolve(null);
	const format = getImageFormat(dataUrl);
	if (format === "JPEG") return Promise.resolve({ dataUrl, format: "JPEG" });
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				const ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0);
				const pngDataUrl = canvas.toDataURL("image/png");
				resolve({ dataUrl: pngDataUrl, format: "PNG" });
			} catch {
				resolve(null);
			}
		};
		img.onerror = () => resolve(null);
		img.src = dataUrl;
	});
};

/**
 * Genera un PDF de consentimiento informado a partir de la plantilla con variables reemplazadas.
 * Cabecera y pie se construyen aquí; el contenido viene de la plantilla.
 * Opcional: options.profile (perfil de Ajustes: company_name, name, surname, collegiate_number, logo_url),
 *           options.logoImage y options.signatureImage (data URLs).
 * @param {object} [options] - { profile?: object, logoImage?: string, signatureImage?: string }
 * @returns {Promise<void>}
 */
export const generateConsentPDF = async (client, treatmentName, templateContent, templateName = "Consentimiento", options = {}) => {
	const doc = new jsPDF();
	const pageHeight = doc.internal.pageSize.height;
	let y = MARGIN;
	const profile = options.profile || null;

	// Logo: primero el subido en el modal; si no, el del perfil (Ajustes). Normalizamos a PNG/JPEG para jsPDF.
	let logoDataUrl = options.logoImage || null;
	if (!logoDataUrl && profile?.logo_url) {
		logoDataUrl = await fetchImageAsDataUrl(profile.logo_url);
	}
	if (logoDataUrl) {
		const normalized = await normalizeImageForJsPDF(logoDataUrl);
		logoDataUrl = normalized ? normalized.dataUrl : null;
	}
	const logoImg = logoDataUrl ? await loadImageForPDF(logoDataUrl, LOGO_MAX_WIDTH_MM, LOGO_MAX_HEIGHT_MM) : null;
	if (logoImg) {
		const xLogo = (PAGE_WIDTH - logoImg.widthMm) / 2;
		doc.addImage(logoImg.dataUrl, logoImg.format || "PNG", xLogo, y, logoImg.widthMm, logoImg.heightMm);
		y += logoImg.heightMm + 4;
	}

	// Nombre de la clínica (desde Ajustes → Nombre Comercial)
	if (profile?.company_name) {
		doc.setFontSize(11);
		doc.setFont("helvetica", "bold");
		doc.setTextColor(0);
		doc.text(profile.company_name, PAGE_WIDTH / 2, y, { align: "center" });
		y += 6;
	}

	// Profesional responsable (desde Ajustes → Nombre, Apellidos, Nº Colegiado)
	const proName = [profile?.name, profile?.surname].filter(Boolean).join(" ").trim();
	if (proName || profile?.collegiate_number) {
		doc.setFontSize(9);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(80);
		const coleg = profile?.collegiate_number ? `, Colegiado Nº: ${profile.collegiate_number}` : "";
		doc.text(`Profesional responsable: ${proName || "—"}${coleg}`, PAGE_WIDTH / 2, y, { align: "center" });
		y += 6;
	}

	doc.setFontSize(14);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(0);
	doc.text("CONSENTIMIENTO INFORMADO", PAGE_WIDTH / 2, y, { align: "center" });
	y += 12;

	// Bloque de datos del paciente (editable en cuanto a qué líneas se muestran; aquí: paciente, fecha nac., email, DNI, tratamiento, fecha)
	doc.setFontSize(10);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(80);
	const clientLine = `${client?.name ?? ""} ${client?.surname ?? ""}`.trim();
	if (clientLine) {
		doc.text(`Paciente: ${clientLine}`, MARGIN, y);
		y += 6;
	}
	const fechaNac = client?.fecha_nacimiento ?? "";
	if (fechaNac) {
		doc.text(`Fecha de nacimiento: ${fechaNac}`, MARGIN, y);
		y += 6;
	}
	const email = client?.email ?? "";
	if (email) {
		doc.text(`Correo electrónico: ${email}`, MARGIN, y);
		y += 6;
	}
	if (client?.nif) {
		doc.text(`NIF/CIF: ${client.nif}`, MARGIN, y);
		y += 6;
	}
	if (treatmentName) {
		doc.text(`Tratamiento: ${treatmentName}`, MARGIN, y);
		y += 6;
	}
	doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`, MARGIN, y);
	y += 14;

	doc.setFontSize(10);
	doc.setTextColor(0);
	const fullText = replaceConsentVariables(templateContent, client, treatmentName);

	if (isHTML(fullText) && typeof document !== "undefined") {
		const canvas = await renderHTMLToCanvas(fullText);
		if (canvas) {
			y = addContentCanvasToPDF(doc, canvas, y);
		} else {
			const plainText = htmlToPlainText(fullText);
			const paragraphs = plainText.split(/\n\n+/);
			for (const para of paragraphs) {
				const lines = wrapText(doc, String(para).trim());
				for (const line of lines) {
					if (y > pageHeight - 25) {
						doc.addPage();
						y = MARGIN;
					}
					doc.text(line, MARGIN, y);
					y += LINE_HEIGHT;
				}
				y += 4;
			}
		}
	} else {
		const plainText = isHTML(fullText) ? htmlToPlainText(fullText) : fullText;
		const paragraphs = plainText.split(/\n\n+/);
		for (const para of paragraphs) {
			const lines = wrapText(doc, String(para).trim());
			for (const line of lines) {
				if (y > pageHeight - 25) {
					doc.addPage();
					y = MARGIN;
				}
				doc.text(line, MARGIN, y);
				y += LINE_HEIGHT;
			}
			y += 4;
		}
	}

	// Espacio para firma (opcional: imagen de firma + línea + texto)
	y += 10;
	if (y > pageHeight - 40) {
		doc.addPage();
		y = MARGIN;
	}
	let signatureDataUrl = options.signatureImage || null;
	if (signatureDataUrl) {
		const normalized = await normalizeImageForJsPDF(signatureDataUrl);
		signatureDataUrl = normalized ? normalized.dataUrl : null;
	}
	const signatureImg = signatureDataUrl ? await loadImageForPDF(signatureDataUrl, SIGNATURE_MAX_WIDTH_MM, SIGNATURE_MAX_HEIGHT_MM) : null;
	if (signatureImg) {
		doc.addImage(signatureImg.dataUrl, signatureImg.format || "PNG", MARGIN, y, signatureImg.widthMm, signatureImg.heightMm);
		y += signatureImg.heightMm + 4;
	}
	doc.setDrawColor(200);
	doc.line(MARGIN, y + 2, MARGIN + 80, y + 2);
	doc.setFontSize(8);
	doc.setTextColor(120);
	doc.text("Firma del paciente", MARGIN, y + 8);

	const safeName = (client?.name || "cliente").replace(/[^a-z0-9]/gi, "_");
	const fileName = `Consentimiento_${templateName.replace(/[^a-z0-9]/gi, "_")}_${safeName}.pdf`;
	doc.save(fileName);
};
