/**
 * Utilidades de validación para formularios fiscales
 */

/**
 * Valida formato básico de NIF/CIF/NIE español
 * @param {string} nif - NIF/CIF/NIE a validar
 * @returns {object} - { valid: boolean, normalized: string, type: 'NIF'|'CIF'|'NIE'|null }
 */
export const validateSpanishTaxId = (nif) => {
	if (!nif || typeof nif !== "string") {
		return { valid: false, normalized: "", type: null, error: "NIF requerido" };
	}

	// Normalizar: eliminar espacios, guiones, puntos y convertir a mayúsculas
	const normalized = nif.replace(/[\s\-\.]/g, "").toUpperCase().trim();

	if (normalized.length === 0) {
		return { valid: false, normalized: "", type: null, error: "NIF requerido" };
	}

	// NIF: 8 dígitos + 1 letra (ej: 12345678Z)
	const nifPattern = /^[0-9]{8}[A-Z]$/;
	if (nifPattern.test(normalized)) {
		return { valid: true, normalized, type: "NIF", error: null };
	}

	// CIF: Letra + 7 dígitos + letra/dígito (ej: B12345678, A1234567C)
	const cifPattern = /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/;
	if (cifPattern.test(normalized)) {
		return { valid: true, normalized, type: "CIF", error: null };
	}

	// NIE: X/Y/Z + 7 dígitos + letra (ej: X1234567L)
	const niePattern = /^[XYZ][0-9]{7}[A-Z]$/;
	if (niePattern.test(normalized)) {
		return { valid: true, normalized, type: "NIE", error: null };
	}

	return {
		valid: false,
		normalized,
		type: null,
		error: "Formato inválido. Use NIF (8 dígitos + letra), CIF o NIE",
	};
};

/**
 * Valida archivo antes de subir
 * @param {File} file - Archivo a validar
 * @param {object} options - Opciones: maxSizeMB, allowedTypes
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateFile = (file, options = {}) => {
	const { maxSizeMB = 10, allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"] } = options;

	if (!file) {
		return { valid: false, error: "Archivo requerido" };
	}

	// Validar tipo
	if (!allowedTypes.includes(file.type)) {
		const allowedExtensions = allowedTypes
			.map((t) => {
				if (t.startsWith("image/")) return t.split("/")[1].toUpperCase();
				if (t === "application/pdf") return "PDF";
				return t;
			})
			.join(", ");
		return { valid: false, error: `Tipo no permitido. Use: ${allowedExtensions}` };
	}

	// Validar tamaño
	const maxSizeBytes = maxSizeMB * 1024 * 1024;
	if (file.size > maxSizeBytes) {
		return { valid: false, error: `Archivo demasiado grande. Máximo: ${maxSizeMB}MB` };
	}

	return { valid: true, error: null };
};

/**
 * Normaliza número de factura
 * @param {string} invoiceNumber - Número de factura
 * @returns {string} - Número normalizado (mayúsculas, sin espacios)
 */
export const normalizeInvoiceNumber = (invoiceNumber) => {
	if (!invoiceNumber) return "";
	return invoiceNumber.replace(/\s+/g, "").toUpperCase().trim();
};

/**
 * Valida coherencia de fecha con otras facturas del mismo proveedor
 * @param {string} date - Fecha a validar
 * @param {string} supplierNif - NIF del proveedor
 * @param {string} invoiceNumber - Número de factura
 * @param {Array} existingEntries - Entradas existentes
 * @returns {object} - { warning: string|null, suggestedDate: string|null }
 */
export const validateInvoiceDateConsistency = (date, supplierNif, invoiceNumber, existingEntries = []) => {
	if (!date || !supplierNif || !invoiceNumber || !existingEntries.length) {
		return { warning: null, suggestedDate: null };
	}

	// Buscar facturas con mismo NIF y número
	const sameInvoice = existingEntries.filter(
		(e) =>
			e.supplier_nif === supplierNif &&
			e.invoice_number === invoiceNumber &&
			e.date !== date &&
			e.is_deductible === true
	);

	if (sameInvoice.length === 0) {
		return { warning: null, suggestedDate: null };
	}

	// Si hay facturas con la misma factura pero fecha diferente
	const dates = sameInvoice.map((e) => e.date).filter(Boolean);
	if (dates.length > 0) {
		const mostCommonDate = dates.sort((a, b) => dates.filter((d) => d === a).length - dates.filter((d) => d === b).length).pop();
		const dateDiff = Math.abs(new Date(date) - new Date(mostCommonDate)) / (1000 * 60 * 60 * 24);

		if (dateDiff > 7) {
			return {
				warning: `Esta factura ya tiene ${sameInvoice.length} material(es) con fecha diferente (${mostCommonDate}). ¿Usar la misma fecha?`,
				suggestedDate: mostCommonDate,
			};
		}
	}

	return { warning: null, suggestedDate: null };
};

/**
 * Obtiene sugerencias de facturas anteriores del mismo proveedor
 * @param {string} supplierNif - NIF del proveedor (parcial o completo)
 * @param {Array} entries - Todas las entradas de gastos
 * @param {number} limit - Número máximo de sugerencias
 * @returns {Array} - Array de facturas sugeridas
 */
export const getInvoiceSuggestions = (supplierNif, entries = [], limit = 5) => {
	if (!supplierNif || supplierNif.length < 3 || !entries.length) {
		return [];
	}

	const normalizedSearch = supplierNif.toUpperCase().trim();

	// Filtrar entradas deducibles con NIF que coincida
	const matching = entries
		.filter(
			(e) =>
				e.is_deductible === true &&
				e.supplier_nif &&
				e.supplier_nif.toUpperCase().includes(normalizedSearch)
		)
		.map((e) => ({
			supplier_nif: e.supplier_nif,
			invoice_number: e.invoice_number,
			date: e.date,
			description: e.description,
			count: 1,
		}));

	// Agrupar por NIF + número de factura y contar
	const grouped = {};
	matching.forEach((item) => {
		const key = `${item.supplier_nif}_${item.invoice_number}`;
		if (!grouped[key]) {
			grouped[key] = { ...item };
		} else {
			grouped[key].count++;
		}
	});

	// Ordenar por fecha más reciente y limitar
	return Object.values(grouped)
		.sort((a, b) => new Date(b.date) - new Date(a.date))
		.slice(0, limit);
};
