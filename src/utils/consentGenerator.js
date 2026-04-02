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
 * - Pie: "Firmado el {fecha} en Terrassa.", luego dos columnas: Firma Profesional (imagen subida encima de su línea)
 *   y Firma del paciente (línea en blanco para firmar).
 */
const MARGIN = 20;
const PAGE_WIDTH = 210;
const LINE_HEIGHT = 6;
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** Ancho del contenido HTML en px (equivalente a ~170mm a 96dpi) para renderizar antes de meter en PDF */
const HTML_CONTENT_WIDTH_PX = 640;
const HTML2CANVAS_SCALE = 2;
/**
 * Tamaño máximo del logo en la cabecera del PDF (mm). Subir valores = logo más grande.
 * Ubicación única para ajustar en el futuro.
 */
const LOGO_MAX_WIDTH_MM = 58;
const LOGO_MAX_HEIGHT_MM = 24;
/**
 * Firma profesional en PDF (mm). Mismo archivo: constantes arriba del todo.
 * Si la firma no aparece, revisar que la URL sea accesible (CORS) y que el archivo sea PNG/JPEG;
 * SVG puede fallar al rasterizar; subir de nuevo como PNG desde Ajustes.
 */
const SIGNATURE_MAX_WIDTH_MM = 65;
const SIGNATURE_MAX_HEIGHT_MM = 28;

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
 * No colapsa saltos de línea: primero normaliza <br> y bloques a \n, luego quita tags.
 */
const htmlToPlainText = (html) => {
	if (!html || !html.trim()) return "";
	let s = String(html);
	// Bloques y saltos explícitos → nueva línea antes de quitar tags
	s = s.replace(/<br\s*\/?>/gi, "\n");
	s = s.replace(/<\/p>/gi, "\n\n");
	s = s.replace(/<\/div>/gi, "\n");
	s = s.replace(/<\/li>/gi, "\n");
	s = s.replace(/<[^>]+>/g, "");
	// Decodificar entidades mínimas
	s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
	// Colapsar solo espacios en la misma línea, no \n
	const lines = s.split("\n");
	const normalized = lines.map((line) => line.replace(/[ \t]+/g, " ").trimEnd());
	return normalized.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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

/**
 * CSS para el HTML renderizado en PDF (html2canvas).
 * - Párrafos vacíos / solo <br>: altura mínima para conservar líneas en blanco entre bloques.
 * - Listas: list-style explícito + display list-item para que salgan viñetas/números, no solo sangría.
 */
const CONSENT_CONTENT_STYLES = `
.consent-content { word-wrap: break-word; }
.consent-content p {
  margin: 0 0 0.85em 0;
  min-height: 0;
}
/* Párrafo vacío o solo salto: ocupa una línea (TipTap suele guardar <p><br></p>) */
.consent-content p:empty,
.consent-content p:has(> br:only-child) {
  min-height: 1.15em;
  margin-bottom: 0.85em;
}
.consent-content p:last-child { margin-bottom: 0; }
/* Listas con viñeta/número visibles (evita que en PDF solo se vea tabulador) */
.consent-content ul {
  list-style-type: disc;
  list-style-position: outside;
  margin: 0.5em 0 0.85em 0;
  padding-left: 1.35em;
}
.consent-content ol {
  list-style-type: decimal;
  list-style-position: outside;
  margin: 0.5em 0 0.85em 0;
  padding-left: 1.5em;
}
.consent-content li {
  display: list-item;
  margin-bottom: 0.35em;
  padding-left: 0.25em;
}
.consent-content ul ul { list-style-type: circle; }
.consent-content h1, .consent-content h2, .consent-content h3 { margin: 0.65em 0 0.4em 0; }
.consent-content .consent-blank-line {
  min-height: 1.15em;
  margin-bottom: 0.85em;
}
`;

/**
 * Renderiza HTML en un div temporal y lo convierte a canvas con html2canvas.
 * El div se monta fuera de pantalla y se elimina después.
 * Aplica estilos para separación entre párrafos (doble salto).
 */
/**
 * Normaliza HTML de TipTap para que las líneas en blanco ocupen altura en el canvas.
 * Sustituye <p></p> y <p><br></p> por un párrafo con espacio no separable.
 */
const normalizeConsentHtmlForPdf = (html) => {
	if (!html) return "";
	let out = html;
	// Párrafos vacíos o solo BR → párrafo con altura garantizada
	out = out.replace(/<p>\s*<\/p>/gi, '<p class="consent-blank-line">&nbsp;</p>');
	out = out.replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '<p class="consent-blank-line">&nbsp;</p>');
	return out;
};

const renderHTMLToCanvas = (html) => {
	if (typeof document === "undefined") return Promise.resolve(null);
	const bodyHtml = normalizeConsentHtmlForPdf(html || "");
	const wrap = document.createElement("div");
	wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:" + HTML_CONTENT_WIDTH_PX + "px;box-sizing:border-box;padding:12px;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;color:#000;background:#fff;";
	wrap.innerHTML = "<style>" + CONSENT_CONTENT_STYLES + "</style><div class=\"consent-content\">" + bodyHtml + "</div>";
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
 * Busca un corte "limpio" en el canvas: filas mayormente blancas hacia arriba desde el límite deseado,
 * para no partir una línea de texto por la mitad entre páginas.
 * @param {HTMLCanvasElement} canvas
 * @param {number} sourceY - inicio del trozo en px
 * @param {number} maxSlicePx - altura máxima deseada del trozo en px
 * @returns {number} altura del trozo en px (>= minSlice si hay contenido)
 */
const findCleanSliceHeight = (canvas, sourceY, maxSlicePx) => {
	const minSlice = Math.min(maxSlicePx, 40);
	if (maxSlicePx <= minSlice) return maxSlicePx;
	const ctx = canvas.getContext("2d");
	const w = canvas.width;
	const scanFrom = sourceY + maxSlicePx - 1;
	const scanTo = Math.max(sourceY + minSlice, sourceY + maxSlicePx - Math.floor(maxSlicePx * 0.35));
	const rowStep = 2;
	const whiteThreshold = 248;
	let consecutiveQuiet = 0;
	const needQuietRows = 3;
	for (let row = scanFrom; row >= scanTo; row -= rowStep) {
		const imageData = ctx.getImageData(0, row, w, 1);
		const data = imageData.data;
		let dark = 0;
		for (let i = 0; i < data.length; i += 16) {
			const r = data[i],
				g = data[i + 1],
				b = data[i + 2];
			if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) dark++;
		}
		const ratio = dark / (w / 4);
		if (ratio < 0.08) {
			consecutiveQuiet++;
			if (consecutiveQuiet >= needQuietRows) {
				const cutY = row - needQuietRows * rowStep;
				const height = Math.max(minSlice, cutY - sourceY);
				if (height <= maxSlicePx && height >= minSlice) return height;
			}
		} else {
			consecutiveQuiet = 0;
		}
	}
	// Alinear a múltiplo de ~media línea (line-height ~15–16px a escala 2 ≈ 30px) para reducir cortes a mitad
	const lineStep = 28;
	const aligned = Math.floor(maxSlicePx / lineStep) * lineStep;
	return Math.max(minSlice, aligned > minSlice ? aligned : maxSlicePx);
};

/**
 * Añade el canvas del contenido al PDF repartiendo en páginas.
 * Los cortes intentan caer en zonas en blanco para no partir frases.
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
		const availableMm = firstPage ? maxYPerPage - startY : maxYPerPage - MARGIN;
		const maxSlicePx = Math.min(remainingPx, Math.ceil(availableMm * mmToPx));
		let slicePx = findCleanSliceHeight(canvas, sourceY, maxSlicePx);
		if (slicePx < remainingPx && slicePx < maxSlicePx * 0.25) {
			slicePx = Math.min(remainingPx, maxSlicePx);
		}
		if (slicePx <= 0) slicePx = Math.min(remainingPx, maxSlicePx);
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
/**
 * Carga imagen desde URL pública a data URL. Acepta blob sin type o octet-stream
 * (Supabase a veces devuelve application/octet-stream aunque sea PNG/JPEG).
 */
const fetchImageAsDataUrl = (url) => {
	if (!url || typeof fetch === "undefined") return Promise.resolve(null);
	const looksLikeImage =
		/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url) || /format=png|format=jpeg/i.test(url);
	return fetch(url, { mode: "cors" })
		.then((r) => {
			if (!r.ok) return null;
			return r.blob();
		})
		.then((blob) => {
			if (!blob) return null;
			const type = blob.type || "";
			if (!type.startsWith("image/") && type !== "application/octet-stream" && !looksLikeImage)
				return null;
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
/**
 * Convierte a PNG/JPEG que jsPDF acepta. Si el canvas falla (SVG, tamaño 0, tainted),
 * devuelve null; el llamador puede usar el dataUrl original con addImage como último recurso.
 */
const normalizeImageForJsPDF = (dataUrl) => {
	if (!dataUrl || typeof document === "undefined") return Promise.resolve(null);
	const format = getImageFormat(dataUrl);
	if (format === "JPEG") return Promise.resolve({ dataUrl, format: "JPEG" });
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			try {
				const w = img.naturalWidth || img.width;
				const h = img.naturalHeight || img.height;
				if (!w || !h) {
					resolve(null);
					return;
				}
				const canvas = document.createElement("canvas");
				canvas.width = w;
				canvas.height = h;
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
 * Si normalize falla, intenta cargar dimensiones con la imagen original y usar dataUrl tal cual
 * (addImage a veces acepta PNG data URL sin pasar por canvas).
 */
const loadImageForPDFFallback = (dataUrl, maxW, maxH) => {
	if (!dataUrl) return Promise.resolve(null);
	return loadImageForPDF(dataUrl, maxW, maxH);
};

/**
 * Genera un PDF de consentimiento informado a partir de la plantilla con variables reemplazadas.
 * Cabecera y pie se construyen aquí; el contenido viene de la plantilla.
 * Logo y firma: solo desde perfil (logo_url, consent_signature_url). options.logoImage / signatureImage
 * siguen existiendo por compatibilidad pero el modal ya no los envía.
 * @param {object} [options] - { profile?: object, logoImage?: string, signatureImage?: string }
 * @returns {Promise<void>}
 */
export const generateConsentPDF = async (
	client,
	treatmentName,
	templateContent,
	templateName = "Consentimiento",
	options = {}
) => {
	const doc = new jsPDF();
	const pageHeight = doc.internal.pageSize.height;
	let y = MARGIN;
	const profile = options.profile || null;
	const clinic = options.clinic || null;

	// Logo: clínica (compartido); fallback a perfil por compatibilidad; opcional override por options.logoImage.
	let logoDataUrl = options.logoImage || null;
	if (!logoDataUrl && clinic?.logo_url) {
		logoDataUrl = await fetchImageAsDataUrl(clinic.logo_url);
	}
	if (!logoDataUrl && profile?.logo_url) {
		logoDataUrl = await fetchImageAsDataUrl(profile.logo_url);
	}
	if (logoDataUrl) {
		const normalized = await normalizeImageForJsPDF(logoDataUrl);
		if (normalized) logoDataUrl = normalized.dataUrl;
		// Si normalize falla (p. ej. SVG), loadImageForPDF con original aún puede funcionar para JPEG
	}
	const logoImg = logoDataUrl ? await loadImageForPDFFallback(logoDataUrl, LOGO_MAX_WIDTH_MM, LOGO_MAX_HEIGHT_MM) : null;
	if (logoImg) {
		const xLogo = (PAGE_WIDTH - logoImg.widthMm) / 2;
		doc.addImage(logoImg.dataUrl, logoImg.format || "PNG", xLogo, y, logoImg.widthMm, logoImg.heightMm);
		y += logoImg.heightMm + 4;
	}

	// Nombre de la clínica (compartido)
	const clinicName = clinic?.name || profile?.company_name || null;
	if (clinicName) {
		doc.setFontSize(11);
		doc.setFont("helvetica", "bold");
		doc.setTextColor(0);
		doc.text(String(clinicName), PAGE_WIDTH / 2, y, { align: "center" });
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
			const rawLines = plainText.split("\n");
			for (const rawLine of rawLines) {
				const line = String(rawLine).trimEnd();
				if (line === "") {
					y += LINE_HEIGHT * 0.6;
					continue;
				}
				const wrapped = wrapText(doc, line);
				for (const w of wrapped) {
					if (y > pageHeight - 25) {
						doc.addPage();
						y = MARGIN;
					}
					doc.text(w, MARGIN, y);
					y += LINE_HEIGHT;
				}
			}
		}
	} else {
		const plainText = isHTML(fullText) ? htmlToPlainText(fullText) : fullText;
		// Conservar líneas en blanco: trocear por \n y pintar cada línea (vacía = solo avance)
		const rawLines = plainText.split("\n");
		for (const rawLine of rawLines) {
			const line = String(rawLine).trimEnd();
			if (line === "") {
				y += LINE_HEIGHT * 0.6;
				continue;
			}
			const wrapped = wrapText(doc, line);
			for (const w of wrapped) {
				if (y > pageHeight - 25) {
					doc.addPage();
					y = MARGIN;
				}
				doc.text(w, MARGIN, y);
				y += LINE_HEIGHT;
			}
		}
	}

	// Bloque de firmas: solo nueva página si no cabe el bloque entero; si hay sitio, a continuación del texto
	const fechaFirma = new Date().toLocaleDateString("es-ES", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});

	// Firma profesional: perfil consent_signature_url o override (cargar antes para calcular altura)
	let signatureDataUrl = options.signatureImage || null;
	if (!signatureDataUrl && profile?.consent_signature_url) {
		signatureDataUrl = await fetchImageAsDataUrl(profile.consent_signature_url);
	}
	let signatureImg = null;
	if (signatureDataUrl) {
		const normalized = await normalizeImageForJsPDF(signatureDataUrl);
		const urlForLoad = normalized ? normalized.dataUrl : signatureDataUrl;
		signatureImg = await loadImageForPDF(urlForLoad, SIGNATURE_MAX_WIDTH_MM, SIGNATURE_MAX_HEIGHT_MM);
		// Si loadImageForPDF devolvió null (p. ej. onerror), intentar addImage directo con JPEG
		if (!signatureImg && getImageFormat(signatureDataUrl) === "JPEG") {
			signatureImg = await loadImageForPDF(signatureDataUrl, SIGNATURE_MAX_WIDTH_MM, SIGNATURE_MAX_HEIGHT_MM);
		}
	}

	// Altura aproximada del bloque: margen + línea fecha + imagen opcional + líneas + etiquetas
	const gapBeforeBlock = 8;
	const fechaLineH = 10;
	const lineAndLabelH = 14;
	const signatureBlockH =
		gapBeforeBlock +
		fechaLineH +
		(signatureImg ? signatureImg.heightMm + 5 : 0) +
		lineAndLabelH;
	const footerReserve = 20;
	if (y + signatureBlockH > pageHeight - footerReserve) {
		doc.addPage();
		y = MARGIN;
	} else {
		y += gapBeforeBlock;
	}

	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(60);
	doc.text(`Firmado el ${fechaFirma} en Terrassa.`, MARGIN, y);
	y += fechaLineH;

	// Dos columnas: izquierda profesional (imagen opcional + línea), derecha paciente
	const colW = (MAX_WIDTH - 10) / 2;
	const xProf = MARGIN;
	const xPac = MARGIN + colW + 10;
	const lineW = Math.min(75, colW - 5);

	const yBlockStart = y;
	// Columna profesional: imagen justo encima de la línea
	if (signatureImg) {
		try {
			doc.addImage(
				signatureImg.dataUrl,
				signatureImg.format || "PNG",
				xProf,
				y,
				signatureImg.widthMm,
				signatureImg.heightMm,
			);
		} catch {
			// Último recurso: JPEG sin pasar por canvas
			if (getImageFormat(signatureImg.dataUrl) === "JPEG") {
				try {
					doc.addImage(signatureImg.dataUrl, "JPEG", xProf, y, signatureImg.widthMm, signatureImg.heightMm);
				} catch {
					/* ignore */
				}
			}
		}
		y = yBlockStart + signatureImg.heightMm + 3;
	}
	doc.setDrawColor(180);
	doc.line(xProf, y + 2, xProf + lineW, y + 2);
	doc.setFontSize(8);
	doc.setTextColor(100);
	doc.text("Firma Profesional", xProf, y + 8);

	// Columna paciente: línea en blanco para firmar (misma altura visual que bloque prof. si hay imagen)
	const yPacLine = signatureImg ? yBlockStart + signatureImg.heightMm + 3 : yBlockStart;
	doc.line(xPac, yPacLine + 2, xPac + lineW, yPacLine + 2);
	doc.text("Firma del paciente", xPac, yPacLine + 8);

	y = Math.max(y + 10, yPacLine + 14);

	const safeName = (client?.name || "cliente").replace(/[^a-z0-9]/gi, "_");
	const fileName = `Consentimiento_${templateName.replace(/[^a-z0-9]/gi, "_")}_${safeName}.pdf`;
	doc.save(fileName);
};
