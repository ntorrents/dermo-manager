import { describe, it, expect } from "vitest";
import {
	calculateIncomeFromPvp,
	resolveClientIrpfRate,
	getTreatmentTaxRate,
	DEFAULT_ESTETIC_TAX_RATE,
} from "./incomeTax";
import { classifyFinanceIssue, financeIssueLabel } from "./financeIssues";
import {
	isSalesInvoice,
	isAbonoEntry,
	parseInvoiceDescription,
} from "./invoiceAnalytics";

describe("calculateIncomeFromPvp", () => {
	it("particular 100€ IVA 21%: cobra 100, base ~82.64", () => {
		const r = calculateIncomeFromPvp(100, 21, 0);
		expect(r.totalAmount).toBe(100);
		expect(r.pvp).toBe(100);
		expect(r.irpfAmount).toBe(0);
		expect(r.baseAmount).toBeCloseTo(82.64, 2);
		expect(r.taxAmount).toBeCloseTo(17.36, 2);
	});

	it("empresa 50€ IVA 0% IRPF 7%: cobra 46.50", () => {
		const r = calculateIncomeFromPvp(50, 0, 7);
		expect(r.baseAmount).toBe(50);
		expect(r.irpfAmount).toBe(3.5);
		expect(r.totalAmount).toBe(46.5);
	});

	it("empresa 100€ IVA 21% IRPF 7%", () => {
		const r = calculateIncomeFromPvp(100, 21, 7);
		expect(r.pvp).toBe(100);
		expect(r.irpfAmount).toBeCloseTo(5.78, 2);
		expect(r.totalAmount).toBeCloseTo(94.22, 2);
	});
});

describe("resolveClientIrpfRate", () => {
	it("0 si no es empresa", () => {
		expect(resolveClientIrpfRate({ is_company: false })).toBe(0);
	});

	it("7% por defecto en empresa", () => {
		expect(resolveClientIrpfRate({ is_company: true })).toBe(7);
	});

	it("respeta % personalizado", () => {
		expect(
			resolveClientIrpfRate({ is_company: true, irpf_withholding_rate: 15 }),
		).toBe(15);
	});
});

describe("getTreatmentTaxRate", () => {
	it("default 21 si falta", () => {
		expect(getTreatmentTaxRate({})).toBe(DEFAULT_ESTETIC_TAX_RATE);
	});

	it("usa tax_rate del tratamiento", () => {
		expect(getTreatmentTaxRate({ tax_rate: 0 })).toBe(0);
	});
});

describe("classifyFinanceIssue", () => {
	it("null si no es gasto deducible", () => {
		expect(classifyFinanceIssue({ type: "income", is_deductible: true })).toBeNull();
	});

	it("missing_invoice", () => {
		expect(
			classifyFinanceIssue({
				type: "expense",
				is_deductible: true,
				supplier_nif: "B12345678",
			}),
		).toBe("missing_invoice");
	});

	it("missing_attachment con factura y nif", () => {
		expect(
			classifyFinanceIssue({
				type: "expense",
				is_deductible: true,
				invoice_number: "F2026-1",
				supplier_nif: "B12345678",
			}),
		).toBe("missing_attachment");
	});
});

describe("financeIssueLabel", () => {
	it("etiqueta conocida", () => {
		expect(financeIssueLabel("missing_invoice")).toBe("Sin nº factura");
	});
});

describe("invoiceAnalytics", () => {
	it("isSalesInvoice excluye plan amigo y sin número", () => {
		expect(isSalesInvoice({ type: "income", invoice_number: "F2026-001" })).toBe(true);
		expect(isSalesInvoice({ type: "income", plan_amigo: true, invoice_number: "X" })).toBe(
			false,
		);
		expect(isSalesInvoice({ type: "income" })).toBe(false);
	});

	it("parseInvoiceDescription", () => {
		const p = parseInvoiceDescription("Peeling (María García)");
		expect(p.treatmentName).toBe("Peeling");
		expect(p.clientHint).toBe("María García");
	});

	it("isAbonoEntry por importe negativo", () => {
		expect(isAbonoEntry({ amount: -50 })).toBe(true);
	});
});
