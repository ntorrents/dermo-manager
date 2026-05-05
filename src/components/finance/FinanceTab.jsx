import React, { useState, useMemo, useEffect } from "react";
import {
	Plus,
	TrendingUp,
	TrendingDown,
	Search,
	FileSpreadsheet,
	Settings,
	Trash2,
	CheckCircle2,
	X,
	Edit2,
	FileText,
	Download,
	Receipt,
	AlertCircle,
	Copy,
	Image as ImageIcon,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import {
	formatCurrency,
	IVA_OPTIONS,
	IRPF_OPTIONS,
	calculateTaxFromTotal,
} from "../../utils/format";
import { calculateTaxReverseGrossToNet } from "../../utils/calculations";
import { exportToCSV, exportTrimestreToExcel } from "../../utils/export";
import { filterByReportingRange } from "../../utils/dateUtils";
import { ReportingPeriodToolbar } from "../ui/ReportingPeriodToolbar";
import {
	uploadReceipt,
	getReceiptUrl,
	getReceiptSignedUrl,
} from "../../services/receiptStorage";
import {
	validateSpanishTaxId,
	validateFile,
	normalizeInvoiceNumber,
	validateInvoiceDateConsistency,
	getInvoiceSuggestions,
} from "../../utils/validations";
import { ConfirmModal } from "../ui/ConfirmModal";
import { LoadingButton } from "../ui/LoadingButton";
import { EmptyState } from "../ui/EmptyState";
import { AdaptiveModal } from "../ui/AdaptiveModal";
import { useTenant } from "../../context/TenantContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { classifyFinanceIssue, financeIssueLabel } from "../../utils/financeIssues";

const INVESTMENT_MIN_BASE = 300;

export const FinanceTab = ({
	user,
	entries = [],
	clients = [],
	reportingRange,
	reportingPreset,
	setReportingPreset,
	reportingAnchorYm,
	setReportingAnchorYm,
	reportingCustomFrom,
	setReportingCustomFrom,
	reportingCustomTo,
	setReportingCustomTo,
	onReportingGoToday,
	showToast,
	onRefresh,
	navIntent = null,
	onNavIntentConsumed,
}) => {
	const { clinicId, isAdmin } = useTenant();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isConfigOpen, setIsConfigOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const debouncedSearchTerm = useDebouncedValue(searchTerm, 180);

	const [recurringExpenses, setRecurringExpenses] = useState([]);
	const [loadingConfig, setLoadingConfig] = useState(true);

	// Estado para Edición
	const [editingEntry, setEditingEntry] = useState(null);

	// ESTADOS PARA CONFIRMACIONES
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [itemToDelete, setItemToDelete] = useState(null);
	const [savingEntry, setSavingEntry] = useState(false);

	// NUEVO: Filtro para la vista móvil (Gasto por defecto)
	const [typeFilter, setTypeFilter] = useState("expense");
	const [financeView, setFinanceView] = useState("movements");
	const [issueFilter, setIssueFilter] = useState("all");

	const [formData, setFormData] = useState({
		type: "expense",
		amount: "",
		tax_rate: 0,
		irpf_rate: 0,
		category: "General",
		description: "",
		date: new Date().toISOString().split("T")[0],
		notes: "",
		is_deductible: false,
		is_investment: false,
		amortization_rate: 26,
		provider_name: "",
		supplier_nif: "",
		invoice_number: "",
		recurring_id: null,
		months_paid: 1,
		coverage_start_month: "",
	});
	const [recurringBaseAmount, setRecurringBaseAmount] = useState(null);
	const [receiptFile, setReceiptFile] = useState(null);
	const [receiptPreview, setReceiptPreview] = useState(null);
	const [nifValidation, setNifValidation] = useState({
		valid: true,
		error: null,
	});
	const [fileValidation, setFileValidation] = useState({
		valid: true,
		error: null,
	});
	const [dateWarning, setDateWarning] = useState(null);
	const [invoiceSuggestions, setInvoiceSuggestions] = useState([]);
	const [showSuggestions, setShowSuggestions] = useState(false);

	const supplierDirectory = useMemo(() => {
		const map = new Map();
		(entries || [])
			.filter((e) => e.type === "expense" && (e.provider_name || e.supplier_nif))
			.forEach((e) => {
				const nif = (e.supplier_nif || "").trim();
				const name = (e.provider_name || "").trim();
				const key = `${nif}__${name}`.toLowerCase();
				if (!map.has(key)) map.set(key, { nif, name });
			});
		return Array.from(map.values()).sort((a, b) =>
			(a.name || a.nif || "").localeCompare(b.name || b.nif || "", "es"),
		);
	}, [entries]);

	const applyProviderFromName = (providerName) => {
		const val = (providerName || "").trim().toLowerCase();
		if (!val) return;
		const matches = supplierDirectory.filter(
			(s) => (s.name || "").trim().toLowerCase() === val,
		);
		if (matches.length === 1) {
			setFormData((prev) => ({
				...prev,
				provider_name: matches[0].name || prev.provider_name,
				supplier_nif: matches[0].nif || prev.supplier_nif,
			}));
		}
	};

	const taxCalc = useMemo(() => {
		if (
			formData.type === "expense" &&
			formData.is_deductible &&
			Number(formData.amount) > 0
		) {
			const { baseAmount, taxAmount, irpfAmount } = calculateTaxReverseGrossToNet(
				formData.amount,
				Number(formData.tax_rate) || 21,
				Number(formData.irpf_rate) || 0,
			);
			return {
				base_amount: baseAmount,
				tax_amount: taxAmount,
				irpf_amount: irpfAmount,
			};
		}
		const { baseAmount, taxAmount } = calculateTaxFromTotal(
			formData.amount,
			formData.tax_rate,
		);
		return {
			base_amount: baseAmount,
			tax_amount: taxAmount,
			irpf_amount: 0,
		};
	}, [formData.amount, formData.tax_rate, formData.irpf_rate, formData.type, formData.is_deductible]);

	const fetchConfig = async () => {
		try {
			setLoadingConfig(true);
			const { data, error } = await supabase.from("recurring_config").select("*");
			if (error) throw error;
			setRecurringExpenses(data || []);
		} catch (error) {
			console.error("Error cargando fijos:", error);
		} finally {
			setLoadingConfig(false);
		}
	};

	useEffect(() => {
		if (user) fetchConfig();
	}, [user]);

	const rangeStart = reportingRange?.start ?? "";
	const rangeEnd = reportingRange?.end ?? "";
	const refMonthYm = reportingRange?.refMonthYm ?? "";

	// Entradas filtradas solo por fecha para cálculos globales
	const periodEntries = useMemo(() => {
		return filterByReportingRange(entries, "date", rangeStart, rangeEnd);
	}, [entries, rangeStart, rangeEnd]);

	// Entradas filtradas para la lista (incluye búsqueda y el filtro de tipo móvil)
	const filteredEntries = useMemo(() => {
		let data = periodEntries;

		if (typeFilter !== "all") {
			data = data.filter((e) => e.type === typeFilter);
		}

	return data
			.filter(
				(e) =>
					e.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
					e.category?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
			)
			.filter((e) => {
				if (issueFilter === "all") return true;
				const issue = classifyFinanceIssue(e);
				if (issueFilter === "any") return Boolean(issue);
				return issue === issueFilter;
			})
			.sort((a, b) => new Date(b.date) - new Date(a.date));
	}, [periodEntries, debouncedSearchTerm, typeFilter, issueFilter]);

	useEffect(() => {
		if (!navIntent || navIntent.source !== "taxes") return;
		setFinanceView("movements");
		setIssueFilter(navIntent.issue || "all");
		onNavIntentConsumed?.();
	}, [navIntent, onNavIntentConsumed]);

	// Cálculos basados en el periodo total
	const totalIncome = periodEntries
		.filter((e) => e.type === "income")
		.reduce((acc, curr) => acc + Number(curr.amount), 0);
	const totalExpense = periodEntries
		.filter((e) => e.type === "expense")
		.reduce((acc, curr) => acc + Number(curr.amount), 0);
	const netProfit = totalIncome - totalExpense;

	const financialAnalysis = useMemo(() => {
		const expenses = periodEntries.filter((e) => e.type === "expense");
		const incomes = periodEntries.filter((e) => e.type === "income");
		const totalSpent = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
		const totalIncomes = incomes.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
		const net = totalIncomes - totalSpent;

		const byCategoryMap = new Map();
		expenses.forEach((e) => {
			const cat = e.category || "Sin categoría";
			const prev = byCategoryMap.get(cat) || 0;
			byCategoryMap.set(cat, prev + (Number(e.amount) || 0));
		});
		const byCategory = Array.from(byCategoryMap.entries())
			.map(([category, amount]) => ({
				category,
				amount,
				pct: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
			}))
			.sort((a, b) => b.amount - a.amount);

		const bySupplierMap = new Map();
		expenses.forEach((e) => {
			const key = (e.provider_name || e.supplier_nif || "Proveedor sin identificar").trim();
			const prev = bySupplierMap.get(key) || { amount: 0, invoices: 0 };
			bySupplierMap.set(key, {
				amount: prev.amount + (Number(e.amount) || 0),
				invoices: prev.invoices + 1,
			});
		});
		const topSuppliers = Array.from(bySupplierMap.entries())
			.map(([name, v]) => ({ name, ...v }))
			.sort((a, b) => b.amount - a.amount)
			.slice(0, 8);

		const now = new Date();
		const months = Array.from({ length: 6 }, (_, i) => {
			const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		});
		const monthSums = Object.fromEntries(
			months.map((m) => [m, { income: 0, expense: 0 }]),
		);
		(entries || []).forEach((e) => {
			const ym = e.date?.slice(0, 7);
			if (!ym || !(ym in monthSums)) return;
			if (e.type === "income") monthSums[ym].income += Number(e.amount) || 0;
			if (e.type === "expense") monthSums[ym].expense += Number(e.amount) || 0;
		});
		const monthlySeries = months.map((m) => ({
			month: m,
			income: monthSums[m].income,
			expense: monthSums[m].expense,
			net: monthSums[m].income - monthSums[m].expense,
		}));
		const avgMonthlyExpense =
			monthlySeries.reduce((acc, m) => acc + m.expense, 0) / monthlySeries.length || 0;
		const fixedMonthlyEstimated =
			(recurringExpenses || []).reduce(
				(acc, r) => acc + (Number(r.amount) || 0),
				0,
			) || 0;
		const variableMonthlyEstimated = Math.max(avgMonthlyExpense - fixedMonthlyEstimated, 0);

		return {
			totalSpent,
			totalIncomes,
			net,
			byCategory,
			topSuppliers,
			monthlySeries,
			avgMonthlyExpense,
			fixedMonthlyEstimated,
			variableMonthlyEstimated,
		};
	}, [periodEntries, entries, recurringExpenses]);

	/** Mes YYYY-MM cae dentro del rango de un pago (date + months_paid)? */
	const monthInRange = (yyyyMm, startDate, monthsPaid) => {
		const start = startDate.slice(0, 7);
		const [y, m] = start.split("-").map(Number);
		const n = monthsPaid || 1;
		const endMonth1Based = m + n - 1;
		const endYear = y + Math.floor((endMonth1Based - 1) / 12);
		const endMonth = ((endMonth1Based - 1) % 12) + 1;
		const end = `${endYear}-${String(endMonth).padStart(2, "0")}`;
		return yyyyMm >= start && yyyyMm <= end;
	};

	const getFixedStatus = (expense) => {
		if (!expense?.id) {
			return { paid: false };
		}
		const currentMonth = refMonthYm.length >= 7 ? refMonthYm.slice(0, 7) : refMonthYm;
		const found = entries.find((e) => {
			if (e.type !== "expense" || e.recurring_id !== expense.id) return false;
			const startDate = e.coverage_start_date || e.date;
			return monthInRange(currentMonth, startDate, e.months_paid ?? 1);
		});
		return found ? { paid: true, date: found.date } : { paid: false };
	};

	const openEntryModal = (type, entry = null) => {
		if (entry) {
			setEditingEntry(entry);
			setFormData({
				type: entry.type,
				amount: entry.amount,
				tax_rate: entry.tax_rate ?? 0,
				irpf_rate: entry.irpf_rate ?? 0,
				category: entry.category,
				description: entry.description,
				date: entry.date,
				notes: entry.notes || "",
				is_deductible: entry.is_deductible ?? false,
				is_investment: entry.is_investment ?? false,
				amortization_rate:
					entry.amortization_rate != null ? Number(entry.amortization_rate) : 26,
				provider_name: entry.provider_name || "",
				supplier_nif: entry.supplier_nif || "",
				invoice_number: entry.invoice_number || "",
				file_url: entry.file_url || "",
				recurring_id: entry.recurring_id ?? null,
				months_paid: entry.months_paid ?? 1,
				coverage_start_month: entry.coverage_start_date
					? entry.coverage_start_date.slice(0, 7)
					: "",
			});
			setRecurringBaseAmount(null);
		} else {
			setEditingEntry(null);
			setFormData({
				type,
				amount: "",
				tax_rate: type === "expense" ? 21 : 0,
				irpf_rate: 0,
				category: type === "income" ? "Servicio" : "Material",
				description: "",
				date: new Date().toISOString().split("T")[0],
				notes: "",
				is_deductible: false,
				is_investment: false,
				amortization_rate: 26,
				provider_name: "",
				supplier_nif: "",
				invoice_number: "",
				file_url: "",
				recurring_id: null,
				months_paid: 1,
				coverage_start_month: "",
			});
			setRecurringBaseAmount(null);
		}
		setReceiptFile(null);
		setReceiptPreview(null);
		setNifValidation({ valid: true, error: null });
		setFileValidation({ valid: true, error: null });
		setDateWarning(null);
		setInvoiceSuggestions([]);
		setShowSuggestions(false);
		setIsModalOpen(true);
	};

	const openPayRecurringModal = (expense) => {
		const base = Number(expense.amount) || 0;
		const defaultMonth =
			refMonthYm.length === 7 ? refMonthYm : new Date().toISOString().slice(0, 7);
		setEditingEntry(null);
		setRecurringBaseAmount(base);
		setFormData({
			type: "expense",
			amount: String(base),
			tax_rate: Number(expense.tax_rate) ?? 21,
			irpf_rate: Number(expense.irpf_rate) ?? 0,
			category: expense.category || "",
			description: expense.category || "",
			date:
				refMonthYm.length === 7
					? `${refMonthYm}-01`
					: new Date().toISOString().split("T")[0],
			notes: "",
			is_deductible: expense.is_deductible ?? false,
			is_investment: false,
			amortization_rate: 26,
			provider_name: "",
			supplier_nif: "",
			invoice_number: "",
			file_url: "",
			recurring_id: expense.id,
			months_paid: 1,
			coverage_start_month: defaultMonth,
		});
		setReceiptFile(null);
		setReceiptPreview(null);
		setNifValidation({ valid: true, error: null });
		setFileValidation({ valid: true, error: null });
		setDateWarning(null);
		setInvoiceSuggestions([]);
		setShowSuggestions(false);
		setIsModalOpen(true);
	};

	// Efecto para validar NIF y obtener sugerencias
	useEffect(() => {
		if (formData.is_deductible && formData.supplier_nif) {
			const validation = validateSpanishTaxId(formData.supplier_nif);
			setNifValidation(validation);

			if (validation.valid && validation.normalized) {
				setFormData((prev) => ({
					...prev,
					supplier_nif: validation.normalized,
				}));
				const expenseEntries = entries.filter(
					(e) => e.type === "expense" && e.is_deductible,
				);
				const suggestions = getInvoiceSuggestions(
					validation.normalized,
					expenseEntries,
					5,
				);
				setInvoiceSuggestions(suggestions);
				setShowSuggestions(
					suggestions.length > 0 && formData.supplier_nif.length >= 3,
				);
			} else {
				setInvoiceSuggestions([]);
				setShowSuggestions(false);
			}
		} else {
			setNifValidation({ valid: true, error: null });
			setInvoiceSuggestions([]);
			setShowSuggestions(false);
		}
	}, [formData.supplier_nif, formData.is_deductible, entries]);

	// Efecto separado para detectar archivo existente cuando hay NIF + número de factura
	useEffect(() => {
		if (
			formData.is_deductible &&
			formData.supplier_nif &&
			formData.invoice_number &&
			!receiptFile &&
			!editingEntry
		) {
			const expenseEntries = entries.filter(
				(e) => e.type === "expense" && e.is_deductible,
			);
			const normalizedNif = nifValidation.normalized || formData.supplier_nif;
			const normalizedInvoice = normalizeInvoiceNumber(formData.invoice_number);

			const existingEntry = expenseEntries.find(
				(e) =>
					e.supplier_nif === normalizedNif &&
					normalizeInvoiceNumber(e.invoice_number) === normalizedInvoice &&
					e.file_url,
			);

			if (existingEntry?.file_url && !formData.file_url) {
				setFormData((prev) => ({ ...prev, file_url: existingEntry.file_url }));
			}
		}
	}, [
		formData.supplier_nif,
		formData.invoice_number,
		formData.is_deductible,
		receiptFile,
		editingEntry,
		entries,
		nifValidation.normalized,
	]);

	// Efecto para validar coherencia de fecha
	useEffect(() => {
		if (
			formData.is_deductible &&
			formData.supplier_nif &&
			formData.invoice_number &&
			formData.date
		) {
			const validation = validateInvoiceDateConsistency(
				formData.date,
				formData.supplier_nif,
				formData.invoice_number,
				entries.filter((e) => e.type === "expense" && e.is_deductible),
			);
			setDateWarning(validation);
		} else {
			setDateWarning(null);
		}
	}, [formData.date, formData.supplier_nif, formData.invoice_number, entries]);

	// Función para usar sugerencia de factura
	const useInvoiceSuggestion = (suggestion) => {
		// Buscar si ya existe un archivo para esta factura
		const existingEntry = entries.find(
			(e) =>
				e.type === "expense" &&
				e.is_deductible &&
				e.supplier_nif === suggestion.supplier_nif &&
				e.invoice_number === suggestion.invoice_number &&
				e.file_url,
		);

		setFormData((prev) => ({
			...prev,
			supplier_nif: suggestion.supplier_nif,
			invoice_number: suggestion.invoice_number,
			date: suggestion.date,
			file_url: existingEntry?.file_url || "",
		}));

		// Si hay archivo existente, no pedir subir uno nuevo
		if (existingEntry?.file_url) {
			setReceiptFile(null);
			setReceiptPreview(null);
		}

		setShowSuggestions(false);
	};

	const handleFileChange = (e) => {
		const file = e.target.files?.[0] || null;
		if (file) {
			const validation = validateFile(file);
			setFileValidation(validation);

			if (validation.valid) {
				setReceiptFile(file);
				// Crear preview
				if (file.type.startsWith("image/")) {
					const reader = new FileReader();
					reader.onloadend = () => {
						setReceiptPreview(reader.result);
					};
					reader.readAsDataURL(file);
				} else {
					setReceiptPreview(null);
				}
			} else {
				setReceiptFile(null);
				setReceiptPreview(null);
				showToast(validation.error, "error");
			}
		} else {
			setReceiptFile(null);
			setReceiptPreview(null);
			setFileValidation({ valid: true, error: null });
		}
	};

	const handleSaveEntry = async (e) => {
		e.preventDefault();

		// Validaciones antes de guardar
		if (formData.is_deductible) {
			// Validar NIF
			const nifValidation = validateSpanishTaxId(formData.supplier_nif);
			if (!nifValidation.valid) {
				showToast(nifValidation.error, "error");
				return;
			}

			// Validar número de factura obligatorio
			if (!formData.invoice_number?.trim()) {
				showToast(
					"El número de factura es obligatorio para facturas deducibles",
					"error",
				);
				return;
			}

			// Validar archivo obligatorio (solo si no hay uno existente)
			if (!receiptFile && !editingEntry?.file_url && !formData.file_url) {
				showToast("Debe subir el archivo de la factura", "error");
				return;
			}

			// Validar archivo si hay uno nuevo
			if (receiptFile) {
				const fileValidation = validateFile(receiptFile);
				if (!fileValidation.valid) {
					showToast(fileValidation.error, "error");
					return;
				}
			}
		}

		setSavingEntry(true);
		try {
			const taxRate = Number(formData.tax_rate) || 0;
			const irpfRate = Number(formData.irpf_rate) || 0;
			const amount = Number(formData.amount);
			let baseAmount, taxAmount, irpfAmount;
			if (
				formData.type === "expense" &&
				formData.is_deductible &&
				amount > 0
			) {
				const calc = calculateTaxReverseGrossToNet(amount, taxRate, irpfRate);
				baseAmount = calc.baseAmount;
				taxAmount = calc.taxAmount;
				irpfAmount = calc.irpfAmount;
			} else {
				const calc = calculateTaxFromTotal(amount, taxRate);
				baseAmount = calc.baseAmount;
				taxAmount = calc.taxAmount;
				irpfAmount = 0;
			}

			// Normalizar número de factura
			const normalizedInvoiceNumber = formData.invoice_number
				? normalizeInvoiceNumber(formData.invoice_number)
				: null;

			if (!clinicId) {
				showToast("No hay clínica activa; no se puede guardar el movimiento.", "error");
				return;
			}
			const qualifiesAsInvestment =
				formData.type === "expense" &&
				formData.is_deductible &&
				!!formData.is_investment &&
				Number(baseAmount) > INVESTMENT_MIN_BASE;

			const payload = {
				type: formData.type,
				amount,
				total_amount: amount,
				tax_rate: taxRate,
				tax_amount: taxAmount,
				tax_base: baseAmount,
				irpf_rate: irpfRate,
				irpf_amount: irpfAmount,
				category: formData.category,
				description: formData.description,
				date: formData.date,
				notes: formData.notes || null,
				is_deductible: formData.is_deductible || false,
				is_investment: qualifiesAsInvestment,
				amortization_rate: qualifiesAsInvestment
					? Number(formData.amortization_rate) || 26
					: null,
				provider_name: formData.is_deductible
					? formData.provider_name?.trim() || null
					: null,
				supplier_nif: formData.is_deductible
					? nifValidation.normalized || null
					: null,
				invoice_number: formData.is_deductible ? normalizedInvoiceNumber : null,
				file_url: receiptFile
					? undefined
					: editingEntry?.file_url || formData.file_url || null,
				recurring_id: formData.recurring_id || null,
				months_paid: formData.recurring_id
					? Number(formData.months_paid) || 1
					: 1,
				coverage_start_date:
					formData.recurring_id && formData.coverage_start_month
						? `${formData.coverage_start_month}-01`
						: null,
				user_id: user.id,
				clinic_id: clinicId,
			};

			let insertedId = null;
			if (editingEntry) {
				const { error } = await supabase
					.from("finance_entries")
					.update(payload)
					.eq("id", editingEntry.id);
				if (error) throw error;
				insertedId = editingEntry.id;
				showToast("Movimiento actualizado");
			} else {
				const { data, error } = await supabase
					.from("finance_entries")
					.insert([{ ...payload, activo: true }])
					.select("id")
					.single();
				if (error) throw error;
				insertedId = data.id;
				showToast("Movimiento registrado");
			}

			// Manejar archivo: subir nuevo o reutilizar existente
			if (formData.is_deductible && insertedId) {
				if (receiptFile) {
					// Subir archivo nuevo
					try {
						// Crear invoiceKey si hay NIF y número de factura para compartir archivo
						const invoiceKey =
							nifValidation.normalized && normalizedInvoiceNumber
								? `${nifValidation.normalized}_${normalizedInvoiceNumber}`
								: null;

						const path = await uploadReceipt(
							user.id,
							insertedId,
							receiptFile,
							invoiceKey,
						);

						// Si hay invoiceKey, actualizar todos los gastos con la misma factura
						if (invoiceKey && clinicId) {
							await supabase
								.from("finance_entries")
								.update({ file_url: path })
								.eq("clinic_id", clinicId)
								.eq("supplier_nif", nifValidation.normalized)
								.eq("invoice_number", normalizedInvoiceNumber)
								.is("file_url", null);
						} else {
							await supabase
								.from("finance_entries")
								.update({ file_url: path })
								.eq("id", insertedId);
						}
					} catch (fileErr) {
						console.error("Error subiendo archivo:", fileErr);
						showToast("Gasto guardado pero error al subir archivo", "error");
					}
				} else if (formData.file_url && !editingEntry) {
					// Reutilizar archivo existente de otra factura con mismo NIF+número
					try {
						await supabase
							.from("finance_entries")
							.update({ file_url: formData.file_url })
							.eq("id", insertedId);
					} catch (fileErr) {
						console.error("Error asignando archivo existente:", fileErr);
					}
				}
			}

			setIsModalOpen(false);
			if (onRefresh) await onRefresh();
		} catch (err) {
			showToast(err?.message || "Error al guardar", "error");
		} finally {
			setSavingEntry(false);
		}
	};

	const handlePayClick = (expense) => {
		openPayRecurringModal(expense);
	};

	const handleDeleteClick = (id) => {
		setItemToDelete(id);
		setShowDeleteModal(true);
	};

	const confirmDelete = async () => {
		if (!itemToDelete) return;
		try {
			const { error } = await supabase
				.from("finance_entries")
				.update({ activo: false })
				.eq("id", itemToDelete);
			if (error) throw error;
			showToast("Movimiento archivado");
			if (onRefresh) await onRefresh();
		} catch (e) {
			console.error(e);
		} finally {
			setShowDeleteModal(false);
			setItemToDelete(null);
		}
	};

	const handleSaveConfig = async (e) => {
		e.preventDefault();
		try {
			const valid = recurringExpenses.filter(
				(exp) => exp.category?.trim() && Number(exp.amount) > 0,
			);
			const withId = valid.filter((exp) => exp.id);
			const withoutId = valid.filter((exp) => !exp.id);
			const idsToKeep = withId.map((exp) => exp.id);

			const { data: existing } = await supabase.from("recurring_config").select("id");
			const toRemove = (existing || []).filter((r) => !idsToKeep.includes(r.id));
			if ((toRemove.length > 0 || (idsToKeep.length === 0 && (existing || []).length > 0)) && !isAdmin) {
				showToast?.("Solo un administrador puede eliminar gastos fijos", "error");
				return;
			}

			if (idsToKeep.length > 0) {
				for (const r of toRemove) {
					await supabase.from("recurring_config").delete().eq("id", r.id);
				}
			} else if (clinicId) {
				await supabase.from("recurring_config").delete().eq("clinic_id", clinicId);
			}

			for (const exp of withId) {
				await supabase
					.from("recurring_config")
					.update({
						category: exp.category.trim(),
						amount: Number(exp.amount),
						is_deductible: exp.is_deductible ?? false,
						tax_rate: Number(exp.tax_rate) ?? 21,
						irpf_rate: Number(exp.irpf_rate) ?? 0,
					})
					.eq("id", exp.id);
			}

			if (withoutId.length > 0) {
				if (!clinicId) {
					showToast?.("No hay clínica activa", "error");
					return;
				}
				const toInsert = withoutId.map((exp) => ({
					user_id: user.id,
					clinic_id: clinicId,
					category: exp.category.trim(),
					amount: Number(exp.amount),
					is_deductible: exp.is_deductible ?? false,
					tax_rate: Number(exp.tax_rate) ?? 21,
					irpf_rate: Number(exp.irpf_rate) ?? 0,
				}));
				const { error } = await supabase.from("recurring_config").insert(toInsert);
				if (error) throw error;
			}

			showToast("Configuración guardada");
			setIsConfigOpen(false);
			fetchConfig();
		} catch (err) {
			console.error(err);
			showToast("Error al configurar", "error");
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in pb-20 md:pb-0">
			{/* MODALES DE CONFIRMACIÓN */}
			<ConfirmModal
				isOpen={showDeleteModal}
				title="Archivar movimiento"
				message="El registro dejará de mostrarse en listados y estadísticas visibles, pero se conserva en base de datos."
				onConfirm={confirmDelete}
				onCancel={() => setShowDeleteModal(false)}
				isDestructive={true}
			/>

			{/* HEADER: BALANCE Y SELECTORES */}
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
				<div className="shrink-0">
					<p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">
						Balance · {reportingRange?.label ?? "—"}
					</p>
					<h2
						className={`text-4xl font-black tracking-tighter ${
							netProfit >= 0 ? "text-gray-800" : "text-rose-500"
						}`}>
						{formatCurrency(netProfit)}
					</h2>
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
					<div className="min-w-0 w-full flex-1">
						<ReportingPeriodToolbar
							preset={reportingPreset}
							onPresetChange={setReportingPreset}
							anchorYm={reportingAnchorYm}
							onAnchorYmChange={setReportingAnchorYm}
							customFrom={reportingCustomFrom}
							customTo={reportingCustomTo}
							onCustomFromChange={setReportingCustomFrom}
							onCustomToChange={setReportingCustomTo}
							rangeLabel={reportingRange?.label}
							onTodayClick={onReportingGoToday}
						/>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<button
							type="button"
							onClick={() =>
								exportToCSV(periodEntries, `Finanzas_${rangeStart}_${rangeEnd}.csv`)
							}
							className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-emerald-800 transition-colors hover:bg-emerald-100"
							title="Exportar CSV">
							<FileSpreadsheet size={18} />
							<span className="hidden font-bold sm:inline text-xs">CSV</span>
						</button>
						<button
							type="button"
							onClick={() => {
								const ventas = periodEntries.filter((e) => e.type === "income");
								const compras = periodEntries.filter(
									(e) => e.type === "expense" && e.is_deductible,
								);
								exportTrimestreToExcel(
									ventas,
									compras,
									clients,
									`Finanzas_${rangeStart}_${rangeEnd}.xlsx`,
								);
							}}
							className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-2.5 py-2 text-emerald-700 transition-colors hover:bg-emerald-50"
							title="Exportar Excel (ventas y compras deducibles del periodo)">
							<FileSpreadsheet size={18} />
							<span className="hidden font-bold sm:inline text-xs">Excel</span>
						</button>
					</div>
				</div>
			</div>
			{/* BOTONES DE ACCIÓN RÁPIDA (Siempre arriba) */}
			<div className="grid grid-cols-2 gap-3 md:gap-6">
				<button
					onClick={() => openEntryModal("income")}
					className="py-4 md:py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 flex justify-center items-center gap-2 active:scale-95 transition-all">
					<Plus size={22} />{" "}
					<span className="uppercase tracking-widest text-sm">Ingreso</span>
				</button>
				<button
					onClick={() => openEntryModal("expense")}
					className="py-4 md:py-5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-100 flex justify-center items-center gap-2 active:scale-95 transition-all">
					<Plus size={22} />{" "}
					<span className="uppercase tracking-widest text-sm">Gasto</span>
				</button>
			</div>

			<div className="inline-flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
				<button
					type="button"
					onClick={() => setFinanceView("movements")}
					className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
						financeView === "movements"
							? "bg-white text-gray-800 shadow-sm"
							: "text-gray-500 hover:text-gray-700"
					}`}>
					Movimientos
				</button>
				<button
					type="button"
					onClick={() => setFinanceView("analysis")}
					className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
						financeView === "analysis"
							? "bg-white text-gray-800 shadow-sm"
							: "text-gray-500 hover:text-gray-700"
					}`}>
					Análisis
				</button>
			</div>

			{/* --- VISTA MÓVIL/TABLET (Tabs y Lista Unificada) --- */}
			{financeView === "movements" && <div className="md:hidden space-y-4">
				{/* Pestañas de Filtro */}
				<div className="flex bg-gray-100 p-1 rounded-xl">
					{["all", "income", "expense"].map((type) => (
						<button
							key={type}
							onClick={() => setTypeFilter(type)}
							className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
								typeFilter === type
									? "bg-white text-gray-800 shadow-sm"
									: "text-gray-400"
							}`}>
							{type === "all"
								? "Todo"
								: type === "income"
									? "Ingresos"
									: "Gastos"}
						</button>
					))}
				</div>

				{/* Buscador Móvil */}
				<div className="relative">
					<Search className="absolute left-3 top-3 text-gray-400" size={18} />
					<input
						placeholder="Buscar en la lista..."
						className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl outline-none"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<div>
					<select
						value={issueFilter}
						onChange={(e) => setIssueFilter(e.target.value)}
						className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-bold">
						<option value="all">Sin filtro fiscal</option>
						<option value="any">Solo con incidencias fiscales</option>
						<option value="missing_invoice">Sin nº factura</option>
						<option value="missing_nif">Sin NIF proveedor</option>
						<option value="invalid_nif">NIF inválido</option>
						<option value="missing_attachment">Sin justificante</option>
					</select>
				</div>

				{/* Lista Móvil Unificada */}
				<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
					{filteredEntries.length > 0 ? (
						filteredEntries.map((entry) => (
							<div
								key={entry.id}
								className="p-4 border-b last:border-0 hover:bg-gray-50 transition-colors flex justify-between items-center group">
								<div>
									<p className="font-bold text-gray-800 text-sm">
										{entry.description}
									</p>
									<p className="text-[10px] text-gray-400 font-bold uppercase">
										{entry.date} • {entry.category}
										{entry.is_deductible && " • Factura deducible"}
										{entry.plan_amigo && " • Plan Amigo (sin factura)"}
									</p>
									{classifyFinanceIssue(entry) && (
										<p className="text-[10px] text-amber-700 font-bold mt-1">
											⚠ {financeIssueLabel(classifyFinanceIssue(entry))}
										</p>
									)}
									{entry.notes && (
										<p className="text-[10px] text-gray-400 italic mt-1 flex items-center gap-1">
											<FileText size={10} /> {entry.notes}
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									{entry.type === "expense" && entry.file_url && (
										<a
											href="#"
											onClick={async (e) => {
												e.preventDefault();
												try {
													const url = await getReceiptSignedUrl(entry.file_url);
													if (url) {
														window.open(url, "_blank");
													} else {
														const publicUrl = getReceiptUrl(entry.file_url);
														if (publicUrl) {
															window.open(publicUrl, "_blank");
														} else {
															showToast(
																"Error: El bucket 'recibos' no existe. Créalo en Supabase Storage.",
																"error",
															);
														}
													}
												} catch (err) {
													console.error("Error descargando archivo:", err);
													if (
														err?.message?.includes("Bucket not found") ||
														err?.error === "Bucket not found"
													) {
														showToast(
															"Error: El bucket 'recibos' no existe. Créalo en Supabase Storage.",
															"error",
														);
													} else {
														showToast("Error al descargar el archivo", "error");
													}
												}
											}}
											className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
											title="Ver/Descargar justificante">
											<Download size={16} />
										</a>
									)}
									<span
										className={`font-black text-sm ${
											entry.type === "income"
												? "text-emerald-500"
												: "text-rose-500"
										}`}>
										{entry.type === "income" ? "+" : "-"}
										{formatCurrency(entry.amount)}
									</span>
									<button
										onClick={() => openEntryModal(null, entry)}
										className="text-gray-300 p-1"
										title="Editar">
										<Edit2 size={14} />
									</button>
									{isAdmin && (
										<button
											onClick={() => handleDeleteClick(entry.id)}
											className="text-gray-300 p-1"
											title="Eliminar">
											<Trash2 size={14} />
										</button>
									)}
								</div>
							</div>
						))
					) : (
						<div className="p-10 text-center text-gray-300 font-bold uppercase text-xs">
							Sin movimientos
						</div>
					)}
				</div>

				{/* Gastos Fijos (Siempre visibles al final en móvil) */}
				<div className="space-y-4 pt-4">
					<div className="flex justify-between items-center px-4">
						<h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">
							Gastos Fijos
						</h3>
						<button
							onClick={() => setIsConfigOpen(true)}
							className="text-[10px] font-black text-gray-400 hover:text-rose-500 uppercase italic flex items-center gap-1">
							<Settings size={12} /> Configurar
						</button>
					</div>
					<div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-3">
						{recurringExpenses.map((exp, idx) => {
							const status = getFixedStatus(exp);
							const canPay = !!exp.id;
							return (
								<div
									key={exp.id ?? `mobile-${idx}`}
									className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${
										status.paid
											? "bg-emerald-50 border-emerald-100"
											: "bg-white border-gray-100"
									}`}>
									<div>
										<p className="font-bold text-gray-800 text-xs">
											{exp.category}
										</p>
										<p className="text-[10px] text-gray-400 font-bold">
											{formatCurrency(exp.amount)}
										</p>
									</div>
									{status.paid ? (
										<CheckCircle2 size={20} className="text-emerald-500" />
									) : canPay ? (
										<button
											onClick={() => handlePayClick(exp)}
											className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors">
											Pagar
										</button>
									) : (
										<span className="text-[10px] text-gray-400 italic">Guardar primero</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>}

			{/* --- VISTA WEB/TABLET: 2 cols en tablet, 3 en escritorio --- */}
			{financeView === "movements" && <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
				{/* COLUMNA 1: INGRESOS */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-4">
						<h3 className="font-black text-gray-700 uppercase text-xs tracking-widest flex items-center gap-2">
							<TrendingUp size={16} className="text-emerald-500" /> Ingresos
						</h3>
						<span className="text-emerald-600 font-black">
							{formatCurrency(totalIncome)}
						</span>
					</div>
					<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[300px]">
						{periodEntries.filter((e) => e.type === "income").length > 0 ? (
							periodEntries
								.filter((e) => e.type === "income")
								.map((entry) => (
									<div
										key={entry.id}
										className="p-4 hover:bg-gray-50 flex justify-between items-center border-b last:border-0 group transition-colors">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-[10px] text-gray-400 font-bold uppercase">
												{entry.date}
												{entry.plan_amigo && " • Plan Amigo"}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<span className="font-black text-emerald-500 mr-1">
												+{formatCurrency(entry.amount)}
											</span>
											<button
												onClick={() => openEntryModal("income", entry)}
												className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
												title="Editar">
												<Edit2 size={14} />
											</button>
											{isAdmin && (
												<button
													onClick={() => handleDeleteClick(entry.id)}
													className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
													title="Eliminar">
													<Trash2 size={14} />
												</button>
											)}
										</div>
									</div>
								))
						) : (
							<div className="p-6">
								<EmptyState
									icon={TrendingUp}
									title="Sin ingresos"
									description="Registra tu primer ingreso en este periodo."
									actionLabel="Registrar ingreso"
									onAction={() => openEntryModal("income")}
								/>
							</div>
						)}
					</div>
				</div>

				{/* COLUMNA 2: GASTOS */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-4">
						<h3 className="font-black text-gray-700 uppercase text-xs tracking-widest flex items-center gap-2">
							<TrendingDown size={16} className="text-rose-500" /> Gastos
						</h3>
						<span className="text-rose-600 font-black">
							{formatCurrency(totalExpense)}
						</span>
					</div>
					<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden min-h-[300px]">
						{periodEntries.filter((e) => e.type === "expense").length > 0 ? (
							periodEntries
								.filter((e) => e.type === "expense")
								.map((entry) => (
									<div
										key={entry.id}
										className="p-4 hover:bg-gray-50 flex justify-between items-center border-b last:border-0 group transition-colors">
										<div>
											<p className="font-bold text-gray-800 text-sm">
												{entry.description}
											</p>
											<p className="text-[10px] text-gray-400 font-bold uppercase">
												{entry.date} •{" "}
												<span className="text-rose-400">{entry.category}</span>
												{entry.is_deductible && " • Factura deducible"}
												{entry.is_deductible &&
													entry.supplier_nif &&
													entry.invoice_number &&
													(() => {
														const sameInvoice = periodEntries.filter(
															(e) =>
																e.type === "expense" &&
																e.is_deductible &&
																e.supplier_nif === entry.supplier_nif &&
																e.invoice_number === entry.invoice_number &&
																e.id !== entry.id,
														).length;
														return sameInvoice > 0
															? ` • ${sameInvoice + 1} materiales`
															: "";
													})()}
											</p>
										</div>
										<div className="flex items-center gap-2">
											{entry.file_url && (
												<a
													href="#"
													onClick={async (e) => {
														e.preventDefault();
														try {
															const url = await getReceiptSignedUrl(
																entry.file_url,
															);
															if (url) {
																window.open(url, "_blank");
															} else {
																// Fallback a URL pública
																const publicUrl = getReceiptUrl(entry.file_url);
																if (publicUrl) {
																	window.open(publicUrl, "_blank");
																} else {
																	showToast(
																		"Error: El bucket 'recibos' no existe. Créalo en Supabase Storage.",
																		"error",
																	);
																}
															}
														} catch (err) {
															console.error("Error descargando archivo:", err);
															if (
																err?.message?.includes("Bucket not found") ||
																err?.error === "Bucket not found"
															) {
																showToast(
																	"Error: El bucket 'recibos' no existe. Créalo en Supabase Storage.",
																	"error",
																);
															} else {
																showToast(
																	"Error al descargar el archivo",
																	"error",
																);
															}
														}
													}}
													className="text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
													title="Ver/Descargar justificante">
													<Download size={16} />
												</a>
											)}
											<span className="font-black text-rose-500 mr-1">
												-{formatCurrency(entry.amount)}
											</span>
											<button
												onClick={() => openEntryModal("expense", entry)}
												className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
												title="Editar">
												<Edit2 size={14} />
											</button>
											{isAdmin && (
												<button
													onClick={() => handleDeleteClick(entry.id)}
													className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
													title="Eliminar">
													<Trash2 size={14} />
												</button>
											)}
										</div>
									</div>
								))
						) : (
							<div className="p-6">
								<EmptyState
									icon={TrendingDown}
									title="Sin gastos"
									description="Registra tu primer gasto en este periodo."
									actionLabel="Registrar gasto"
									onAction={() => openEntryModal("expense")}
								/>
							</div>
						)}
					</div>
				</div>

				{/* COLUMNA 3: CONTROL DE FIJOS */}
				<div className="space-y-4">
					<div className="flex justify-between items-center px-4">
						<h3 className="font-black text-gray-700 uppercase text-xs tracking-widest">
							Control de Fijos
						</h3>
						<button
							onClick={() => setIsConfigOpen(true)}
							className="text-[10px] font-black text-gray-400 hover:text-rose-500 flex items-center gap-1 uppercase tracking-widest italic transition-colors">
							<Settings size={14} /> Configurar
						</button>
					</div>
					<div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 space-y-3">
						{recurringExpenses.map((exp, idx) => {
							const status = getFixedStatus(exp);
							const canPay = !!exp.id;
							return (
								<div
									key={exp.id ?? `desktop-${idx}`}
									className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${
										status.paid
											? "bg-emerald-50/30 border-emerald-100 shadow-none"
											: "bg-white border-gray-100 shadow-sm hover:border-rose-100"
									}`}>
									<div>
										<p className="font-black text-gray-800 text-sm leading-tight">
											{exp.category}
										</p>
										<p className="text-xs text-gray-400 font-bold">
											{formatCurrency(exp.amount)}
										</p>
									</div>
									{status.paid ? (
										<CheckCircle2 size={22} className="text-emerald-500" />
									) : canPay ? (
										<button
											onClick={() => handlePayClick(exp)}
											className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-md transition-all active:scale-95">
											Pagar
										</button>
									) : (
										<span className="text-xs text-gray-400 italic">Guardar primero</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>}

			{financeView === "analysis" && (
				<div className="space-y-5">
					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
						<div className="bg-white p-4 rounded-2xl border border-gray-100">
							<p className="text-[10px] font-black uppercase text-gray-400">Gasto periodo</p>
							<p className="text-2xl font-black text-rose-600">
								{formatCurrency(financialAnalysis.totalSpent)}
							</p>
						</div>
						<div className="bg-white p-4 rounded-2xl border border-gray-100">
							<p className="text-[10px] font-black uppercase text-gray-400">Ingreso periodo</p>
							<p className="text-2xl font-black text-emerald-600">
								{formatCurrency(financialAnalysis.totalIncomes)}
							</p>
						</div>
						<div className="bg-white p-4 rounded-2xl border border-gray-100">
							<p className="text-[10px] font-black uppercase text-gray-400">Resultado periodo</p>
							<p
								className={`text-2xl font-black ${
									financialAnalysis.net >= 0 ? "text-emerald-600" : "text-rose-600"
								}`}>
								{formatCurrency(financialAnalysis.net)}
							</p>
						</div>
						<div className="bg-white p-4 rounded-2xl border border-gray-100">
							<p className="text-[10px] font-black uppercase text-gray-400">
								Coste medio mensual (6m)
							</p>
							<p className="text-2xl font-black text-gray-800">
								{formatCurrency(financialAnalysis.avgMonthlyExpense)}
							</p>
						</div>
						<div className="bg-white p-4 rounded-2xl border border-gray-100">
							<p className="text-[10px] font-black uppercase text-gray-400">
								Coste fijo mensual estimado
							</p>
							<p className="text-2xl font-black text-blue-700">
								{formatCurrency(financialAnalysis.fixedMonthlyEstimated)}
							</p>
						</div>
					</div>

					<div className="bg-white p-5 rounded-2xl border border-gray-100">
						<div className="flex items-center justify-between mb-3">
							<p className="text-xs font-black uppercase tracking-wider text-gray-500">
								Evolución mensual (últimos 6 meses)
							</p>
							<p className="text-xs text-gray-500">
								Variable estimado/mes:{" "}
								<span className="font-bold text-gray-700">
									{formatCurrency(financialAnalysis.variableMonthlyEstimated)}
								</span>
							</p>
						</div>
						<div className="overflow-x-auto">
							<div className="min-w-[520px] grid grid-cols-6 gap-3">
								{financialAnalysis.monthlySeries.map((m) => {
									const scaleBase = Math.max(
										...financialAnalysis.monthlySeries.map((x) => x.expense || 0),
										1,
									);
									const h = Math.max(8, Math.round((m.expense / scaleBase) * 120));
									return (
										<div key={m.month} className="flex flex-col items-center gap-2">
											<div className="h-32 w-full flex items-end">
												<div
													className="w-full rounded-t-lg bg-rose-400/80"
													style={{ height: `${h}px` }}
													title={`${m.month}: ${formatCurrency(m.expense)}`}
												/>
											</div>
											<p className="text-[10px] font-bold text-gray-500">
												{m.month.slice(5)}
											</p>
											<p className="text-[10px] font-bold text-gray-700">
												{formatCurrency(m.expense)}
											</p>
										</div>
									);
								})}
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
						<div className="bg-white p-5 rounded-2xl border border-gray-100">
							<p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-3">
								¿En qué se va el dinero? (categorías)
							</p>
							<div className="space-y-2">
								{financialAnalysis.byCategory.map((c) => (
									<div key={c.category} className="space-y-1">
										<div className="flex justify-between text-xs">
											<span className="font-bold text-gray-700">{c.category}</span>
											<span className="font-bold text-gray-600">
												{formatCurrency(c.amount)} · {c.pct.toFixed(1)}%
											</span>
										</div>
										<div className="h-2 rounded-full bg-gray-100 overflow-hidden">
											<div
												className="h-full bg-rose-400 rounded-full"
												style={{ width: `${Math.min(c.pct, 100)}%` }}
											/>
										</div>
									</div>
								))}
								{financialAnalysis.byCategory.length === 0 && (
									<p className="text-sm text-gray-400">Sin gastos en el periodo.</p>
								)}
							</div>
						</div>

						<div className="bg-white p-5 rounded-2xl border border-gray-100">
							<p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-3">
								Top proveedores (gasto)
							</p>
							<div className="space-y-2">
								{financialAnalysis.topSuppliers.map((s, i) => (
									<div
										key={`${s.name}-${i}`}
										className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
										<div>
											<p className="font-bold text-sm text-gray-800">{s.name}</p>
											<p className="text-[10px] text-gray-500">
												{s.invoices} factura{s.invoices === 1 ? "" : "s"}
											</p>
										</div>
										<p className="font-black text-rose-600">{formatCurrency(s.amount)}</p>
									</div>
								))}
								{financialAnalysis.topSuppliers.length === 0 && (
									<p className="text-sm text-gray-400">Sin datos de proveedores en el periodo.</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			<AdaptiveModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={
					editingEntry
						? "Editar Movimiento"
						: formData.recurring_id
							? "Registrar pago recurrente"
							: formData.type === "income"
								? "Registrar Ingreso"
								: "Registrar Gasto"
				}
				maxWidth="max-w-md">
				<form onSubmit={handleSaveEntry} className="space-y-5">
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
							Descripción
						</label>
						<input
							required
							className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-gray-200 outline-none"
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
						/>
					</div>
					{formData.type === "expense" && (
						<div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
							<input
								type="checkbox"
								id="is_deductible"
								checked={formData.is_deductible}
								onChange={(e) => {
									const checked = e.target.checked;
									const baseForDefault = Number(taxCalc.base_amount) || 0;
									setFormData({
										...formData,
										is_deductible: checked,
										is_investment: checked
											? formData.is_investment || baseForDefault > INVESTMENT_MIN_BASE
											: false,
										amortization_rate: checked
											? formData.amortization_rate || 26
											: 26,
										tax_rate: checked ? 21 : 0,
										irpf_rate: checked ? formData.irpf_rate : 0,
										supplier_nif: checked ? formData.supplier_nif : "",
										invoice_number: checked ? formData.invoice_number : "",
									});
								}}
								className="w-5 h-5 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
							/>
							<label
								htmlFor="is_deductible"
								className="font-bold text-gray-800 cursor-pointer flex-1">
								¿Es Factura Deducible?
							</label>
						</div>
					)}
					{formData.type === "expense" && formData.is_deductible && (
						<div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={!!formData.is_investment}
									onChange={(e) =>
										setFormData({
											...formData,
											is_investment: e.target.checked,
											amortization_rate: e.target.checked
												? formData.amortization_rate || 26
												: 26,
										})
									}
									className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<span className="font-bold text-gray-800">
									¿Es Bien de Inversión (Amortizable)?
								</span>
							</label>
							{formData.is_investment && (
								<div>
									<label className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1 block ml-1">
										% Amortización anual
									</label>
									<input
										type="number"
										min="0.01"
										step="0.01"
										className="w-full p-3 bg-white rounded-xl font-bold border border-blue-200 outline-none"
										value={formData.amortization_rate ?? 26}
										onChange={(e) =>
											setFormData({
												...formData,
												amortization_rate: Number(e.target.value) || 26,
											})
										}
									/>
									{Number(taxCalc.base_amount) <= INVESTMENT_MIN_BASE && (
										<p className="mt-2 text-xs text-blue-700 font-bold">
											Si la base no supera {INVESTMENT_MIN_BASE}€, este gasto se
											imputa de golpe (no amortiza).
										</p>
									)}
								</div>
							)}
						</div>
					)}
					<div className="flex gap-4">
						<div className="flex-1">
							<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
								Total a Pagar (€)
							</label>
							<input
								required
								type="number"
								step="0.01"
								placeholder="0.00 €"
								className="w-full p-4 bg-gray-50 rounded-xl font-black text-rose-500 text-xl placeholder:text-rose-300"
								value={formData.amount}
								onChange={(e) =>
									setFormData({ ...formData, amount: e.target.value })
								}
							/>
						</div>
						{formData.type === "expense" && formData.is_deductible && (
							<>
								<div className="flex-1">
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
										IVA (%)
									</label>
									<select
										className="w-full p-4 bg-gray-50 rounded-xl font-bold"
										value={formData.tax_rate}
										onChange={(e) =>
											setFormData({
												...formData,
												tax_rate: Number(e.target.value),
											})
										}>
										{IVA_OPTIONS.map((v) => (
											<option key={v} value={v}>
												{v}%
											</option>
										))}
									</select>
								</div>
								<div className="flex-1">
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
										IRPF (%)
									</label>
									<select
										className="w-full p-4 bg-gray-50 rounded-xl font-bold"
										value={formData.irpf_rate}
										onChange={(e) =>
											setFormData({
												...formData,
												irpf_rate: Number(e.target.value),
											})
										}>
										{IRPF_OPTIONS.map((v) => (
											<option key={v} value={v}>
												{v}%
											</option>
										))}
									</select>
								</div>
							</>
						)}
					</div>
					{formData.type === "expense" &&
						formData.is_deductible &&
						formData.amount && (
							<div className="text-xs font-bold text-gray-500 bg-gray-50 p-3 rounded-xl">
								Base: {formatCurrency(taxCalc.base_amount)} | IVA: +
								{formatCurrency(taxCalc.tax_amount)}
								{Number(taxCalc.irpf_amount) > 0 && (
									<> | IRPF: −{formatCurrency(taxCalc.irpf_amount)}</>
								)}
							</div>
						)}
					{formData.type === "expense" &&
						formData.recurring_id &&
						recurringBaseAmount != null && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
										Nº de meses a pagar
									</label>
									<input
										type="number"
										min={1}
										className="w-full p-3 bg-gray-50 rounded-xl font-bold"
										value={formData.months_paid}
										onChange={(e) => {
											const m = Math.max(1, parseInt(e.target.value, 10) || 1);
											setFormData({
												...formData,
												months_paid: m,
												amount: String(recurringBaseAmount * m),
											});
										}}
									/>
									<p className="text-[10px] text-gray-400 mt-1">
										Total:{" "}
										{formatCurrency(
											recurringBaseAmount * (formData.months_paid || 1),
										)}{" "}
										(importe × meses)
									</p>
								</div>
								<div>
									<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
										Mes de inicio de cobertura
									</label>
									<input
										type="month"
										className="w-full p-3 bg-gray-50 rounded-xl font-bold"
										value={formData.coverage_start_month || ""}
										onChange={(e) =>
											setFormData({
												...formData,
												coverage_start_month: e.target.value,
											})
										}
									/>
									<p className="text-[10px] text-gray-400 mt-1">
										Se considerará pagado desde ese mes durante{" "}
										{formData.months_paid || 1} mes(es).
									</p>
								</div>
							</div>
						)}
					{formData.type === "expense" && formData.is_deductible && (
						<>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
									Proveedor (nombre)
								</label>
								<input
									placeholder="Ej: Distribuciones Estéticas SL"
									list="finance-providers-list"
									className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
									value={formData.provider_name || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											provider_name: e.target.value,
										})
									}
									onBlur={(e) => applyProviderFromName(e.target.value)}
								/>
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
									NIF/CIF Proveedor *
								</label>
								<div className="relative">
									<input
										required={formData.is_deductible}
										placeholder="Ej: B12345678"
										className={`w-full p-4 bg-gray-50 rounded-xl font-bold border-2 outline-none transition-colors ${
											nifValidation.valid
												? "border-transparent focus:bg-white focus:border-rose-100"
												: "border-red-300 bg-red-50 focus:bg-white focus:border-red-400"
										}`}
										value={formData.supplier_nif}
										onChange={(e) =>
											setFormData({ ...formData, supplier_nif: e.target.value })
										}
										onFocus={() =>
											setShowSuggestions(invoiceSuggestions.length > 0)
										}
									/>
									{nifValidation.error && (
										<p className="mt-1 text-xs font-bold text-red-600 flex items-center gap-1">
											<AlertCircle size={12} />
											{nifValidation.error}
										</p>
									)}
									{nifValidation.valid && nifValidation.type && (
										<p className="mt-1 text-xs font-bold text-emerald-600">
											✓ {nifValidation.type} válido
										</p>
									)}
								</div>
								{showSuggestions && invoiceSuggestions.length > 0 && (
									<div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
										<p className="text-xs font-bold text-blue-800 mb-2">
											Facturas anteriores de este proveedor:
										</p>
										<div className="space-y-2">
											{invoiceSuggestions.map((sug, idx) => (
												<button
													key={idx}
													type="button"
													onClick={() => useInvoiceSuggestion(sug)}
													className="w-full p-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left flex items-center justify-between group">
													<div className="flex-1 min-w-0">
														<p className="text-xs font-bold text-gray-800 truncate">
															Factura: {sug.invoice_number}
														</p>
														<p className="text-[10px] text-gray-500">
															{sug.date} • {sug.count} material(es)
														</p>
													</div>
													<Copy
														size={14}
														className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
													/>
												</button>
											))}
										</div>
									</div>
								)}
							</div>
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
									Nº Factura Proveedor *
								</label>
								<input
									required={formData.is_deductible}
									placeholder="Ej: F2026-001"
									className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none"
									value={formData.invoice_number}
									onChange={(e) =>
										setFormData({
											...formData,
											invoice_number: normalizeInvoiceNumber(e.target.value),
										})
									}
								/>
							</div>
							{dateWarning?.warning && (
								<div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
									<p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-2">
										<AlertCircle size={14} />
										{dateWarning.warning}
									</p>
									{dateWarning.suggestedDate && (
										<button
											type="button"
											onClick={() =>
												setFormData((prev) => ({
													...prev,
													date: dateWarning.suggestedDate,
												}))
											}
											className="text-xs font-bold text-amber-700 hover:underline">
											Usar fecha: {dateWarning.suggestedDate}
										</button>
									)}
								</div>
							)}
							<div>
								<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
									Justificante (foto o PDF){" "}
									{editingEntry?.file_url || formData.file_url ? "" : "*"}
								</label>
								{(editingEntry?.file_url || formData.file_url) &&
									!receiptFile && (
										<div className="mb-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
											<div className="flex items-center justify-between mb-2">
												<span className="text-sm font-bold text-emerald-700 flex items-center gap-2">
													<FileText size={16} />
													Archivo existente:{" "}
													{(editingEntry?.file_url || formData.file_url)
														.split("/")
														.pop()}
												</span>
												<a
													href="#"
													onClick={async (e) => {
														e.preventDefault();
														const fileUrl =
															editingEntry?.file_url || formData.file_url;
														if (fileUrl) {
															try {
																const url = await getReceiptSignedUrl(fileUrl);
																if (url) {
																	window.open(url, "_blank");
																} else {
																	const publicUrl = getReceiptUrl(fileUrl);
																	if (publicUrl)
																		window.open(publicUrl, "_blank");
																}
															} catch (err) {
																showToast("Error al abrir archivo", "error");
															}
														}
													}}
													className="text-xs font-bold text-emerald-600 hover:underline">
													Ver
												</a>
											</div>
											<p className="text-xs text-emerald-600 italic">
												Este archivo se reutilizará. Puedes cambiarlo si lo
												deseas.
											</p>
											<button
												type="button"
												onClick={(e) => {
													e.preventDefault();
													const input =
														document.getElementById("receipt-file-input");
													if (input) input.click();
												}}
												className="mt-2 text-xs font-bold text-emerald-600 hover:underline">
												Cambiar archivo
											</button>
										</div>
									)}
								{receiptPreview && (
									<div className="mb-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
										<p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
											<ImageIcon size={14} />
											Vista previa:
										</p>
										<img
											src={receiptPreview}
											alt="Preview"
											className="max-w-full h-auto max-h-32 rounded-lg border border-gray-300"
										/>
									</div>
								)}
								<input
									id="receipt-file-input"
									required={
										formData.is_deductible &&
										!editingEntry?.file_url &&
										!formData.file_url
									}
									type="file"
									accept="image/jpeg,image/png,image/webp,application/pdf"
									className="w-full p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:font-bold file:bg-rose-50 file:text-rose-600"
									onChange={handleFileChange}
								/>
								{receiptFile && (
									<p className="mt-2 text-xs font-bold text-emerald-600">
										✓ Archivo seleccionado: {receiptFile.name} (
										{(receiptFile.size / 1024 / 1024).toFixed(2)} MB)
									</p>
								)}
								{fileValidation.error && (
									<p className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1">
										<AlertCircle size={12} />
										{fileValidation.error}
									</p>
								)}
							</div>
						</>
					)}
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
							Fecha
						</label>
						<input
							required
							type="date"
							className="w-full p-4 bg-gray-50 rounded-xl font-bold text-sm"
							value={formData.date}
							onChange={(e) =>
								setFormData({ ...formData, date: e.target.value })
							}
						/>
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
							Categoría
						</label>
						{formData.recurring_id ? (
							<input
								required
								className="w-full p-4 bg-gray-50 rounded-2xl font-bold border-2 border-transparent focus:bg-white focus:border-gray-200 outline-none"
								value={formData.category}
								onChange={(e) =>
									setFormData({ ...formData, category: e.target.value })
								}
								placeholder="Ej: Cuota autónomos"
							/>
						) : (
							<select
								className="w-full p-4 bg-gray-50 rounded-2xl font-bold"
								value={formData.category}
								onChange={(e) =>
									setFormData({ ...formData, category: e.target.value })
								}>
								{formData.type === "income" ? (
									<>
										<option>Servicio</option>
										<option>Producto</option>
										<option>Otros</option>
									</>
								) : (
									<>
										<option>Material</option>
										<option>Alquiler</option>
										<option>Marketing</option>
										<option>Suministros</option>
										<option>Otros</option>
									</>
								)}
							</select>
						)}
					</div>
					<div>
						<label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">
							Notas
						</label>
						<textarea
							rows="2"
							className="w-full p-4 bg-gray-50 rounded-2xl font-bold resize-none"
							value={formData.notes}
							onChange={(e) =>
								setFormData({ ...formData, notes: e.target.value })
							}
						/>
					</div>
					<LoadingButton
						loading={savingEntry}
						type="submit"
						className={`w-full py-4 rounded-xl font-black text-white shadow-lg ${
							formData.type === "income" ? "bg-emerald-500" : "bg-rose-500"
						}`}>
						{savingEntry ? "Guardando..." : "Guardar"}
					</LoadingButton>
				</form>
				<datalist id="finance-providers-list">
					{supplierDirectory
						.filter((s) => (s.name || "").trim().length > 0)
						.map((s) => (
						<option
							key={`${s.nif}-${s.name}`}
							value={s.name || ""}
							label={
								s.name
									? s.nif
										? `${s.name} (${s.nif})`
										: s.name
									: s.nif
									? `Sin nombre (${s.nif})`
									: "Proveedor"
							}
						/>
					))}
				</datalist>
			</AdaptiveModal>

			<AdaptiveModal
				isOpen={isConfigOpen}
				onClose={() => setIsConfigOpen(false)}
				title="Gastos Fijos"
				maxWidth="max-w-md">
				<form onSubmit={handleSaveConfig} className="space-y-6">
					<div className="max-h-[400px] overflow-y-auto space-y-6 pr-2 custom-scrollbar">
						{recurringExpenses.map((exp, idx) => (
							<div
								key={exp.id ?? `new-${idx}`}
								className="space-y-3 p-4 bg-gray-50 rounded-[1.5rem] relative group border border-transparent hover:border-gray-200 transition-all">
								{isAdmin && (
									<button
										type="button"
										onClick={() =>
											setRecurringExpenses(
												recurringExpenses.filter((_, i) => i !== idx),
											)
										}
										className="absolute -top-2 -right-2 bg-white text-gray-300 hover:text-rose-500 p-1 rounded-full shadow-sm border border-gray-100">
										<X size={14} />
									</button>
								)}
								<div>
									<label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">
										Categoría / Concepto
									</label>
									<input
										required
										className="w-full p-3 bg-white border border-gray-100 rounded-xl font-bold text-sm"
										value={exp.category ?? ""}
										onChange={(e) => {
											const newExps = [...recurringExpenses];
											newExps[idx] = { ...newExps[idx], category: e.target.value };
											setRecurringExpenses(newExps);
										}}
										placeholder="Ej: Cuota autónomos, Alquiler"
									/>
								</div>
								<div>
									<label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">
										Importe (€/mes)
									</label>
									<input
										type="number"
										step="0.01"
										required
										placeholder="0.00 €"
										className="w-full p-3 bg-white border border-gray-100 rounded-xl font-black text-lg placeholder:text-gray-300"
										value={exp.amount ?? ""}
										onChange={(e) => {
											const newExps = [...recurringExpenses];
											newExps[idx] = { ...newExps[idx], amount: e.target.value };
											setRecurringExpenses(newExps);
										}}
									/>
								</div>
								<div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
									<input
										type="checkbox"
										id={`recurring-deductible-${idx}`}
										checked={exp.is_deductible ?? false}
										onChange={(e) => {
											const newExps = [...recurringExpenses];
											newExps[idx] = {
												...newExps[idx],
												is_deductible: e.target.checked,
												tax_rate: e.target.checked ? (newExps[idx].tax_rate ?? 21) : 0,
												irpf_rate: e.target.checked ? (newExps[idx].irpf_rate ?? 0) : 0,
											};
											setRecurringExpenses(newExps);
										}}
										className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
									/>
									<label htmlFor={`recurring-deductible-${idx}`} className="text-xs font-bold text-gray-700">
										Es deducible
									</label>
								</div>
								{(exp.is_deductible ?? false) && (
									<div className="grid grid-cols-2 gap-2">
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">IVA (%)</label>
											<select
												className="w-full p-2 bg-white border border-gray-100 rounded-lg font-bold text-sm"
												value={exp.tax_rate ?? 21}
												onChange={(e) => {
													const newExps = [...recurringExpenses];
													newExps[idx] = { ...newExps[idx], tax_rate: Number(e.target.value) };
													setRecurringExpenses(newExps);
												}}>
												{IVA_OPTIONS.map((v) => (
													<option key={v} value={v}>{v}%</option>
												))}
											</select>
										</div>
										<div>
											<label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">IRPF (%)</label>
											<select
												className="w-full p-2 bg-white border border-gray-100 rounded-lg font-bold text-sm"
												value={exp.irpf_rate ?? 0}
												onChange={(e) => {
													const newExps = [...recurringExpenses];
													newExps[idx] = { ...newExps[idx], irpf_rate: Number(e.target.value) };
													setRecurringExpenses(newExps);
												}}>
												{IRPF_OPTIONS.map((v) => (
													<option key={v} value={v}>{v}%</option>
												))}
											</select>
										</div>
									</div>
								)}
							</div>
						))}
						<button
							type="button"
							onClick={() =>
								setRecurringExpenses([
									...recurringExpenses,
									{ category: "", amount: 0, is_deductible: false, tax_rate: 21, irpf_rate: 0 },
								])
							}
							className="w-full py-3 border-2 border-dashed border-gray-100 text-gray-400 rounded-2xl font-black text-[10px] uppercase hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
							<Plus size={14} /> Añadir concepto
						</button>
					</div>
					<button
						type="submit"
						className="w-full bg-surface-dark text-white font-black py-5 rounded-[1.5rem] shadow-xl text-lg mt-4">
						Guardar
					</button>
				</form>
			</AdaptiveModal>
		</div>
	);
};
