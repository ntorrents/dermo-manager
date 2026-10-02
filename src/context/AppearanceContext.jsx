import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	APPEARANCE_STORAGE_KEY,
	DEFAULT_APPEARANCE,
	getThemeById,
} from "../constants/appearanceThemes";

const AppearanceContext = createContext(null);

const readStored = () => {
	try {
		const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
		if (!raw) return { ...DEFAULT_APPEARANCE };
		const parsed = JSON.parse(raw);
		return {
			themeId: parsed.themeId || DEFAULT_APPEARANCE.themeId,
			density: parsed.density || DEFAULT_APPEARANCE.density,
		};
	} catch {
		return { ...DEFAULT_APPEARANCE };
	}
};

const applyDom = ({ themeId, density }) => {
	const root = document.documentElement;
	const theme = getThemeById(themeId);
	root.setAttribute("data-theme", theme.id);
	root.setAttribute("data-density", density === "compact" ? "compact" : "comfortable");
	root.style.colorScheme = theme.mode === "dark" ? "dark" : "light";
};

export const AppearanceProvider = ({ children }) => {
	const [prefs, setPrefs] = useState(() => {
		const initial = typeof window !== "undefined" ? readStored() : { ...DEFAULT_APPEARANCE };
		if (typeof window !== "undefined") applyDom(initial);
		return initial;
	});

	useEffect(() => {
		applyDom(prefs);
		try {
			localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs));
		} catch {
			/* ignore quota */
		}
	}, [prefs]);

	const setThemeId = useCallback((themeId) => {
		setPrefs((prev) => ({ ...prev, themeId }));
	}, []);

	const setDensity = useCallback((density) => {
		setPrefs((prev) => ({
			...prev,
			density: density === "compact" ? "compact" : "comfortable",
		}));
	}, []);

	const theme = useMemo(() => getThemeById(prefs.themeId), [prefs.themeId]);

	const value = useMemo(
		() => ({
			themeId: prefs.themeId,
			density: prefs.density,
			theme,
			isDark: theme.mode === "dark",
			setThemeId,
			setDensity,
		}),
		[prefs.themeId, prefs.density, theme, setThemeId, setDensity],
	);

	return (
		<AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
	);
};

export const useAppearance = () => {
	const ctx = useContext(AppearanceContext);
	if (!ctx) {
		throw new Error("useAppearance debe usarse dentro de AppearanceProvider");
	}
	return ctx;
};
