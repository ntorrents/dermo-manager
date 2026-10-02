/** Temas y densidades de la UI (persistidos en localStorage). */

export const APPEARANCE_STORAGE_KEY = "baseclinica.appearance.v1";

export const DENSITY_OPTIONS = [
	{
		id: "comfortable",
		label: "Cómoda",
		desc: "Más aire entre bloques (recomendado).",
	},
	{
		id: "compact",
		label: "Compacta",
		desc: "Más contenido visible por pantalla.",
	},
];

/** @typedef {{ id: string, label: string, desc: string, mode: 'light'|'dark', preview: { bg: string, surface: string, primary: string } }} AppearanceTheme */

/** @type {AppearanceTheme[]} */
export const APPEARANCE_THEMES = [
	{
		id: "clinic-teal",
		label: "Clínica Teal",
		desc: "Por defecto. Calmado y clínico.",
		mode: "light",
		preview: { bg: "#F8FAFC", surface: "#FFFFFF", primary: "#0F766E" },
	},
	{
		id: "clinic-rose",
		label: "Clínica Rose",
		desc: "La paleta anterior, suavizada.",
		mode: "light",
		preview: { bg: "#F8FAFC", surface: "#FFFFFF", primary: "#BE185D" },
	},
	{
		id: "graphite-indigo",
		label: "Graphite Indigo",
		desc: "Más «software», acento índigo.",
		mode: "light",
		preview: { bg: "#F8FAFC", surface: "#FFFFFF", primary: "#4338CA" },
	},
	{
		id: "sand-olive",
		label: "Sand Olive",
		desc: "Cálido boutique (claro).",
		mode: "light",
		preview: { bg: "#F7F5F0", surface: "#FFFCFA", primary: "#3F6212" },
	},
	{
		id: "midnight",
		label: "Midnight",
		desc: "Oscuro slate + teal.",
		mode: "dark",
		preview: { bg: "#0B1220", surface: "#151E2E", primary: "#2DD4BF" },
	},
	{
		id: "obsidian",
		label: "Obsidian",
		desc: "Oscuro neutro + índigo suave.",
		mode: "dark",
		preview: { bg: "#09090B", surface: "#18181B", primary: "#A5B4FC" },
	},
];

export const DEFAULT_APPEARANCE = {
	themeId: "clinic-teal",
	density: "comfortable",
};

export const getThemeById = (id) =>
	APPEARANCE_THEMES.find((t) => t.id === id) || APPEARANCE_THEMES[0];
