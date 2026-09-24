import { describe, expect, it } from "vitest";
import { computeModelo130 } from "./modelo130";
import { computeModelo303 } from "./modelo303";

const entries = [
	{
		id: "1",
		type: "income",
		date: "2026-01-15",
		tax_base: 1000,
		tax_amount: 210,
		irpf_amount: 0,
		plan_amigo: false,
	},
	{
		id: "2",
		type: "income",
		date: "2026-04-10",
		tax_base: 2000,
		tax_amount: 420,
		irpf_amount: 0,
		plan_amigo: false,
	},
	{
		id: "3",
		type: "expense",
		date: "2026-02-01",
		tax_base: 100,
		tax_amount: 21,
		is_deductible: true,
		is_investment: false,
	},
	{
		id: "4",
		type: "expense",
		date: "2026-05-01",
		tax_base: 200,
		tax_amount: 42,
		is_deductible: true,
		is_investment: false,
	},
];

describe("computeModelo130 YTD", () => {
	it("T1 solo suma ene-mar", () => {
		const t1 = computeModelo130(entries, 2026, 1, []);
		expect(t1.casilla01).toBe(1000);
		expect(t1.casilla02).toBe(100);
		expect(t1.casilla03).toBe(900);
		expect(t1.casilla07).toBe(0);
		expect(t1.casilla19).toBe(180); // 20% de 900
	});

	it("T2 acumula desde ene y resta T1", () => {
		const t2 = computeModelo130(entries, 2026, 2, []);
		expect(t2.casilla01).toBe(3000);
		expect(t2.casilla02).toBe(300);
		expect(t2.casilla03).toBe(2700);
		expect(t2.casilla07).toBe(180); // pago estimado T1
		expect(t2.casilla19).toBe(360); // 540 - 180
	});

	it("usa result_amount presentado en casilla 07", () => {
		const decls = [
			{
				model: "130",
				year: 2026,
				period: "T1",
				status: "completed",
				result_amount: 150,
			},
		];
		const t2 = computeModelo130(entries, 2026, 2, decls);
		expect(t2.casilla07).toBe(150);
		expect(t2.previousPayments[0].source).toBe("presented");
	});
});

describe("computeModelo303 isolated", () => {
	it("T2 no incluye enero", () => {
		const t2 = computeModelo303(entries, 2026, 2, []);
		expect(t2.ivaRepercutido).toBe(420);
		expect(t2.ivaSoportado).toBe(42);
		expect(t2.casilla110).toBe(0);
		expect(t2.resultado).toBe(378);
	});

	it("resta Casilla 110 del trimestre anterior a compensar", () => {
		const decls = [
			{
				model: "303",
				year: 2026,
				period: "T1",
				status: "completed",
				result_amount: -100,
			},
		];
		const t2 = computeModelo303(entries, 2026, 2, decls);
		expect(t2.casilla110).toBe(100);
		expect(t2.diferencia).toBe(378);
		expect(t2.resultado).toBe(278);
		expect(t2.boxes.some((b) => b.id === "110")).toBe(true);
	});
});
