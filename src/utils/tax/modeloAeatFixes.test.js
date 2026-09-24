import { describe, expect, it } from "vitest";
import { computeModelo303, creditCarryFrom303 } from "./modelo303";
import { computeModelo115 } from "./modelo115";
import { computeModelo180, computeModelo390 } from "./modelo390";
import { countUniquePerceptors } from "./perceptors";

const expense = (overrides) => ({
	id: overrides.id || "e1",
	type: "expense",
	is_deductible: true,
	date: "2026-02-10",
	amount: 100,
	tax_amount: 0,
	...overrides,
});

describe("countUniquePerceptors", () => {
	it("agrupa por NIF aunque haya varias líneas", () => {
		const n = countUniquePerceptors([
			{ id: "1", supplier_nif: "B12345678", provider_name: "Local A" },
			{ id: "2", supplier_nif: "B12345678", provider_name: "Local A" },
			{ id: "3", supplier_nif: "B12345678", provider_name: "Otro nombre" },
		]);
		expect(n).toBe(1);
	});

	it("distingue NIFs distintos", () => {
		const n = countUniquePerceptors([
			{ id: "1", supplier_nif: "B11111111" },
			{ id: "2", supplier_nif: "B22222222" },
		]);
		expect(n).toBe(2);
	});

	it("usa nombre si no hay NIF", () => {
		const n = countUniquePerceptors([
			{ id: "1", provider_name: "Arrendador Uno" },
			{ id: "2", provider_name: "Arrendador Uno" },
			{ id: "3", provider_name: "Arrendador Dos" },
		]);
		expect(n).toBe(2);
	});
});

describe("Modelo 115 Casilla 01", () => {
	it("no cuenta líneas sino perceptores únicos", () => {
		const entries = [
			expense({
				id: "a",
				date: "2026-01-05",
				withholding_kind: "115",
				irpf_amount: 50,
				supplier_nif: "B12345678",
				provider_name: "Dueño",
				category: "Alquiler",
			}),
			expense({
				id: "b",
				date: "2026-02-05",
				withholding_kind: "115",
				irpf_amount: 50,
				supplier_nif: "B12345678",
				provider_name: "Dueño",
				category: "Alquiler",
			}),
			expense({
				id: "c",
				date: "2026-03-05",
				withholding_kind: "115",
				irpf_amount: 50,
				supplier_nif: "B12345678",
				provider_name: "Dueño",
				category: "Alquiler",
			}),
		];
		const data = computeModelo115(entries, 2026, 1);
		expect(data.audit.expenses).toHaveLength(3);
		expect(data.perceptores).toBe(1);
		expect(data.boxes.find((b) => b.id === "01").value).toBe(1);
	});
});

describe("Modelo 303 Casilla 110", () => {
	it("usa credit_carry_amount presentado, no el recálculo en vivo", () => {
		const entries = [
			{
				id: "i1",
				type: "income",
				date: "2026-01-15",
				amount: 1210,
				tax_amount: 210,
				plan_amigo: false,
			},
			{
				id: "x1",
				type: "expense",
				date: "2026-01-20",
				amount: 1210,
				tax_amount: 310,
				is_deductible: true,
			},
			{
				id: "i2",
				type: "income",
				date: "2026-04-15",
				amount: 1210,
				tax_amount: 210,
				plan_amigo: false,
			},
		];
		// T1 en vivo quedó a compensar ~100, pero Hacienda tiene 80 congelados
		const declarations = [
			{
				model: "303",
				year: 2026,
				period: "T1",
				status: "completed",
				result_amount: -80,
				credit_carry_amount: 80,
			},
		];
		const t2 = computeModelo303(entries, 2026, 2, declarations);
		expect(t2.casilla110).toBe(80);
		expect(t2.casilla110Source).toBe("presented");
		expect(t2.casilla110Estimated).toBe(false);

		const t2Estimated = computeModelo303(entries, 2026, 2, []);
		expect(t2Estimated.casilla110Estimated).toBe(true);
		expect(t2Estimated.casilla110).toBeGreaterThan(80);
	});

	it("creditCarryFrom303 = 87 + |71| si negativo", () => {
		expect(creditCarryFrom303({ casilla71: -100, casilla87: 50 })).toBe(150);
		expect(creditCarryFrom303({ casilla71: 200, casilla87: 40 })).toBe(40);
	});
});

describe("Modelo 390 Casilla 110", () => {
	it("usa Casilla 87 del T4, no la suma de las 110", () => {
		const entries = [
			{
				id: "x1",
				type: "expense",
				date: "2026-01-10",
				amount: 1210,
				tax_amount: 210,
				is_deductible: true,
			},
			{
				id: "i4",
				type: "income",
				date: "2026-11-10",
				amount: 605,
				tax_amount: 105,
				plan_amigo: false,
			},
		];
		const data = computeModelo390(entries, 2026, []);
		const sum110 = data.quarters.reduce((a, q) => a + (q.casilla110 || 0), 0);
		expect(data.casilla110).toBe(data.quarters[3].casilla87);
		expect(data.casilla110).not.toBe(sum110);
	});
});

describe("Modelo 180 Casilla 01", () => {
	it("cuenta perceptores únicos del año", () => {
		const entries = [
			expense({
				id: "a",
				date: "2026-01-05",
				withholding_kind: "115",
				irpf_amount: 50,
				supplier_nif: "B12345678",
				category: "Alquiler",
			}),
			expense({
				id: "b",
				date: "2026-07-05",
				withholding_kind: "115",
				irpf_amount: 50,
				supplier_nif: "B12345678",
				category: "Alquiler",
			}),
		];
		const data = computeModelo180(entries, 2026);
		expect(data.perceptores).toBe(1);
	});
});
