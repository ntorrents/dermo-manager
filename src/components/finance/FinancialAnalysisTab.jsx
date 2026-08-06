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
import { calculateIncomeFromPvp } from "../../utils/incomeTax";
import {
	buildSupplierDirectory,
	matchProviderByName,
} from "../../utils/supplierDirectory";
import { ProviderDatalist } from "../ui/ProviderDatalist";
import { exportToCSV, exportTrimestreToExcel } from "../../utils/export";
import { filterByReportingRange } from "../../utils/dateUtils";
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
import { DailyCashCloseCard } from "./DailyCashCloseCard";

const INVESTMENT_MIN_BASE = 300;
const FINANCE_UI_MODE_KEY = "financeUiMode.v1";

export const FinancialAnalysisTab = ({
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
	const financeUiMode = "management";
	const isAdvanced = financeUiMode === "advanced";

	const setFinanceMode = (mode) => {
		// setFinanceUiMode(mode);
		try {
			localStorage.setItem(FINANCE_UI_MODE_KEY, mode);
		} catch {
			/* ignore */
		}
		if (mode === "basic") {
			setFinanceView("movements");
			setIssueFilter("all");
		}
	};

	const applyQuickPeriod = (which) => {
		const d = new Date();
		const ymd = d.toISOString().slice(0, 10);
		if (which === "today") {
			setReportingPreset("custom");
			setReportingCustomFrom(ymd);
			setReportingCustomTo(ymd);
			return;
		}
		if (which === "week") {
			const start = new Date(d);
			const dow = start.getDay();
			const diff = dow === 0 ? 6 : dow - 1;
			start.setDate(start.getDate() - diff);
			setReportingPreset("custom");
			setReportingCustomFrom(start.toISOString().slice(0, 10));
			setReportingCustomTo(ymd);
			return;
		}
		setReportingPreset("month");
		setReportingAnchorYm(d.toISOString().slice(0, 7));
	};

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

	const supplierDirectory = useMemo(
		() => buildSupplierDirectory(entries),
		[entries],
	);

	const applyProviderFromName = (providerName) => {
		const match = matchProviderByName(supplierDirectory, providerName);
		if (!match) return;
		setFormData((prev) => ({
			...prev,
			provider_name: match.name || prev.provider_name,
			supplier_nif: match.nif || prev.supplier_nif,
		}));
	};

	const taxCalc = useMemo(() => {
		const amount = Number(formData.amount);
		if (amount <= 0) {
			return { base_amount: 0, tax_amount: 0, irpf_amount: 0, total_amount: 0 };
		}
		const taxRate = Number(formData.tax_rate) ?? 0;
		const irpfRate = Number(formData.irpf_rate) || 0;
		if (formData.type === "income") {
			const { baseAmount, taxAmount, irpfAmount, totalAmount } = calculateIncomeFromPvp(
				amount,
				taxRate,
				irpfRate,
			);
			return {
				base_amount: baseAmount,
				tax_amount: taxAmount,
				irpf_amount: irpfAmount,
				total_amount: totalAmount,
			};
		}
		if (formData.type === "expense" && formData.is_deductible) {
			const { baseAmount, taxAmount, irpfAmount } = calculateTaxReverseGrossToNet(
				amount,
				taxRate,
				irpfRate,
			);
			return {
				base_amount: baseAmount,
				tax_amount: taxAmount,
				irpf_amount: irpfAmount,
				total_amount: amount,
			};
		}
		const { baseAmount, taxAmount } = calculateTaxFromTotal(amount, taxRate);
		return {
			base_amount: baseAmount,
			tax_amount: taxAmount,
			irpf_amount: 0,
			total_amount: amount,
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

	const isSingleDayRange =
		Boolean(rangeStart) && Boolean(rangeEnd) && rangeStart === rangeEnd;
	/** Cierre de caja: solo al ver un único día (p. ej. botón «Hoy» en modo básico). */
	const showCashClose = !isAdvanced && isSingleDayRange;
	const cashCloseDate = showCashClose ? rangeStart : null;

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
				amount:
					entry.type === "income"
						? String(
								Math.round(
									(Number(entry.amount) || 0) +
										(Number(entry.irpf_amount) || 0),
								) * 100,
							) / 100
						: entry.amount,
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
				tax_rate: 21,
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
			const inputAmount = Number(formData.amount);
			let baseAmount, taxAmount, irpfAmount, amount;
			if (formData.type === "income" && inputAmount > 0) {
				const calc = calculateIncomeFromPvp(inputAmount, taxRate, irpfRate);
				baseAmount = calc.baseAmount;
				taxAmount = calc.taxAmount;
				irpfAmount = calc.irpfAmount;
				amount = calc.totalAmount;
			} else if (
				formData.type === "expense" &&
				formData.is_deductible &&
				inputAmount > 0
			) {
				const calc = calculateTaxReverseGrossToNet(inputAmount, taxRate, irpfRate);
				baseAmount = calc.baseAmount;
				taxAmount = calc.taxAmount;
				irpfAmount = calc.irpfAmount;
				amount = inputAmount;
			} else {
				const calc = calculateTaxFromTotal(inputAmount, taxRate);
				baseAmount = calc.baseAmount;
				taxAmount = calc.taxAmount;
				irpfAmount = 0;
				amount = inputAmount;
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
		<div className="flex-1 min-w-0 bg-gray-50 overflow-y-auto custom-scrollbar pb-20 md:pb-0">
			<div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
				
								<div className="space-y-5">
					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
						<div className="bg-white p-4 rounded-2xl border border-gray-100">
							<p className="text-[10px] font-black uppercase text-gray-400">Gasto periodo</p>
							<p className="text-2xl font-black text-rose-700">
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
									financialAnalysis.net >= 0 ? "text-emerald-600" : "text-rose-700"
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
										<p className="font-black text-rose-700">{formatCurrency(s.amount)}</p>
									</div>
								))}
								{financialAnalysis.topSuppliers.length === 0 && (
									<p className="text-sm text-gray-400">Sin datos de proveedores en el periodo.</p>
								)}
							</div>
						</div>
					</div>
				</div>

			</div>
		</div>
	);
};
