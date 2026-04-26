import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const TEMPLATE_URL = `${import.meta.env.BASE_URL}agenciatributaria/plantilla-libros-iva-aeat.xlsx`;

const EXP_SHEET = "EXPEDIDAS_INGRESOS";
const REC_SHEET = "RECIBIDAS_GASTOS";
/** Primera fila de datos (0-based) según plantilla AEAT 01-01-2026 */
const DATA_ROW_0 = 4;
const EXP_COLS = 36;
const REC_COLS = 42;

const getQuarterRange = (year, quarter) => {
	const startMonth = (quarter - 1) * 3;
	const startDate = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
	const endMonth = quarter * 3;
	const endDay = new Date(year, endMonth, 0).getDate();
	const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
	return { startDate, endDate };
};

const toDdMmYyyy = (isoDate) => {
	if (!isoDate || typeof isoDate !== "string") return "";
	const [y, m, d] = isoDate.split("-");
	if (!y || !m || !d) return "";
	return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
};

const parseSerieNumero = (invoiceNumber) => {
	const s = String(invoiceNumber || "").trim();
	if (!s) return { serie: "", numero: "" };
	const m = s.match(/^([^/\\-]{1,20})[\\/\\-](.+)$/);
	if (m) return { serie: m[1].trim().slice(0, 20), numero: m[2].trim().slice(0, 20) };
	return { serie: "", numero: s.slice(0, 40) };
};

const num = (v) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};

const nifTipoIdent = (nifRaw) => {
	const n = String(nifRaw || "").replace(/\s/g, "").toUpperCase();
	if (!n) return { tipo: "", pais: "", id: "" };
	if (/^[A-Z]\d{7}[0-9A-Z]$/.test(n)) return { tipo: "03", pais: "ES", id: n };
	if (/^\d{8}[0-9A-Z]$/.test(n)) return { tipo: "02", pais: "ES", id: n };
	return { tipo: "02", pais: "ES", id: n.slice(0, 20) };
};

const padRow = (len, fill) => {
	const r = Array.from({ length: len }, () => "");
	for (const k of Object.keys(fill)) {
		const i = Number(k);
		if (i >= 0 && i < len && fill[k] !== undefined && fill[k] !== null) r[i] = fill[k];
	}
	return r;
};

const buildExpedidaRow = (year, quarter, e, client) => {
	const { serie, numero } = parseSerieNumero(e.invoice_number);
	const nif = nifTipoIdent(client?.nif);
	const base = num(e.tax_base ?? e.base_amount ?? e.amount);
	const iva = num(e.tax_amount);
	const total = num(e.total_amount ?? e.amount);
	const rate = base > 0 ? Math.round((iva / base) * 10000) / 100 : num(e.tax_rate);
	const name = client
		? `${client.name || ""} ${client.surname || ""}`.trim().slice(0, 120)
		: "";

	return padRow(EXP_COLS, {
		0: year,
		1: String(quarter).padStart(2, "0"),
		5: "F1",
		8: toDdMmYyyy(e.date),
		9: toDdMmYyyy(e.date),
		10: serie,
		11: numero,
		13: nif.tipo,
		14: nif.pais,
		15: nif.id,
		16: name,
		17: "01",
		18: "S1",
		20: total,
		21: base,
		22: rate,
		23: iva,
	});
};

const supplierName = (e) =>
	String(e.provider_name || e.description || "Proveedor").trim().slice(0, 120);

const buildRecibidaRow = (year, quarter, e) => {
	const nif = nifTipoIdent(e.supplier_nif);
	const base = num(e.tax_base ?? e.base_amount ?? e.amount);
	const iva = num(e.tax_amount);
	const total = num(e.total_amount ?? e.amount);
	const rate = base > 0 ? Math.round((iva / base) * 10000) / 100 : num(e.tax_rate);

	return padRow(REC_COLS, {
		0: year,
		1: String(quarter).padStart(2, "0"),
		5: "F1",
		7: base,
		8: toDdMmYyyy(e.date),
		9: toDdMmYyyy(e.date),
		10: String(e.invoice_number || "").slice(0, 40),
		12: toDdMmYyyy(e.date),
		15: nif.tipo,
		16: nif.pais,
		17: nif.id,
		18: supplierName(e),
		19: "01",
		25: total,
		26: base,
		27: rate,
		28: iva,
		29: iva,
		37: num(e.irpf_amount) > 0 ? num(e.irpf_amount) : "",
	});
};

/**
 * Rellena la plantilla oficial AEAT (Libros registro unificados) con ingresos y gastos del trimestre.
 * Uso: importar en el servicio Pre303 / Libros registro (no sustituye validación fiscal ni asesoramiento).
 */
export async function exportPre303LibrosTrimestre(
	entries = [],
	clients = [],
	year,
	quarter,
	showToast = () => {},
) {
	const { startDate, endDate } = getQuarterRange(year, quarter);
	const quarterEntries = entries.filter((e) => e.date >= startDate && e.date <= endDate);

	const ventas = quarterEntries.filter(
		(e) => e.type === "income" && Number(e.amount) > 0 && !e.plan_amigo,
	);
	const compras = quarterEntries.filter((e) => e.type === "expense" && e.is_deductible === true);

	showToast("Descargando plantilla AEAT...", "info");
	const res = await fetch(TEMPLATE_URL);
	if (!res.ok) throw new Error(`No se pudo cargar la plantilla (${res.status})`);
	const buf = await res.arrayBuffer();

	const wb = XLSX.read(buf, { type: "array" });
	if (!wb.SheetNames.includes(EXP_SHEET) || !wb.SheetNames.includes(REC_SHEET)) {
		throw new Error("Plantilla AEAT inesperada: faltan hojas EXPEDIDAS_INGRESOS / RECIBIDAS_GASTOS");
	}

	const expRows = ventas.map((e) => {
		const client = clients.find((c) => c.id === e.client_id);
		return buildExpedidaRow(year, quarter, e, client);
	});
	const recRows = compras.map((e) => buildRecibidaRow(year, quarter, e));

	const wsExp = wb.Sheets[EXP_SHEET];
	const wsRec = wb.Sheets[REC_SHEET];

	if (expRows.length) {
		XLSX.utils.sheet_add_aoa(wsExp, expRows, { origin: { r: DATA_ROW_0, c: 0 } });
	}
	if (recRows.length) {
		XLSX.utils.sheet_add_aoa(wsRec, recRows, { origin: { r: DATA_ROW_0, c: 0 } });
	}

	const endExp = expRows.length ? DATA_ROW_0 + expRows.length - 1 : 102;
	const endRec = recRows.length ? DATA_ROW_0 + recRows.length - 1 : 102;
	const maxR = Math.max(102, endExp, endRec);
	wsExp["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: EXP_COLS - 1 } });
	wsRec["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: REC_COLS - 1 } });

	const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
	const name = `Libros_IVA_AEAT_${year}_T${quarter}.xlsx`;
	saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
	showToast(`Libro IVA generado (${ventas.length} expedidas, ${compras.length} recibidas). Revísalo en la Sede antes de importar.`, "success");
}
