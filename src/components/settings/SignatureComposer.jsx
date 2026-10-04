import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus, Loader2, PenLine, Trash2, Type, CaseSensitive } from "lucide-react";
import { uploadProfileAsset } from "../../services/profileAssetStorage";

const MODES = [
	{ id: "draw", label: "Dibujar", icon: PenLine },
	{ id: "type", label: "Escribir", icon: Type },
	{ id: "initials", label: "Iniciales", icon: CaseSensitive },
	{ id: "upload", label: "Imagen", icon: ImagePlus },
];

const TYPE_FONTS = [
	{ id: "caveat", label: "Manuscrita", css: '"Caveat", cursive', size: 54 },
	{ id: "vibes", label: "Elegante", css: '"Great Vibes", cursive', size: 48 },
	{ id: "sans", label: "Clara", css: "Inter, system-ui, sans-serif", size: 36 },
];

function dataUrlToFile(dataUrl, filename = "signature.png") {
	const [header, base64] = dataUrl.split(",");
	const mime = /data:(.*?);/.exec(header)?.[1] || "image/png";
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return new File([bytes], filename, { type: mime });
}

function buildInitials(name = "", surname = "") {
	const a = (name || "").trim().charAt(0);
	const b = (surname || "").trim().charAt(0);
	return `${a}${b}`.toUpperCase() || "XX";
}

/**
 * Editor de firma profesional: dibujar, escribir, iniciales o subir imagen.
 * Genera PNG y lo sube a storage (sin pedir URL a mano).
 */
export function SignatureComposer({
	userId,
	valueUrl = "",
	defaultName = "",
	defaultSurname = "",
	defaultTitle = "",
	onChangeUrl,
	onPersist,
	showToast,
}) {
	const [mode, setMode] = useState("draw");
	const [busy, setBusy] = useState(false);
	const [typedName, setTypedName] = useState(defaultName || "");
	const [typedTitle, setTypedTitle] = useState(defaultTitle || "");
	const [fontId, setFontId] = useState("caveat");
	const [initials, setInitials] = useState(buildInitials(defaultName, defaultSurname));

	const canvasRef = useRef(null);
	const drawing = useRef(false);
	const last = useRef(null);
	const previewRef = useRef(null);

	useEffect(() => {
		setTypedName((prev) => prev || defaultName || "");
		setInitials((prev) => (prev && prev !== "XX" ? prev : buildInitials(defaultName, defaultSurname)));
	}, [defaultName, defaultSurname]);

	const clearCanvas = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}, []);

	useEffect(() => {
		if (mode !== "draw") return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = Math.max(1, Math.floor(rect.width * ratio));
		canvas.height = Math.max(1, Math.floor(rect.height * ratio));
		const ctx = canvas.getContext("2d");
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.strokeStyle = "#0f172a";
		ctx.lineWidth = 2.4;
	}, [mode]);

	const pointerPos = (e) => {
		const canvas = canvasRef.current;
		const rect = canvas.getBoundingClientRect();
		const point = e.touches?.[0] || e;
		return {
			x: point.clientX - rect.left,
			y: point.clientY - rect.top,
		};
	};

	const startDraw = (e) => {
		e.preventDefault();
		drawing.current = true;
		last.current = pointerPos(e);
	};

	const moveDraw = (e) => {
		if (!drawing.current) return;
		e.preventDefault();
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		const pos = pointerPos(e);
		ctx.beginPath();
		ctx.moveTo(last.current.x, last.current.y);
		ctx.lineTo(pos.x, pos.y);
		ctx.stroke();
		last.current = pos;
	};

	const endDraw = () => {
		drawing.current = false;
		last.current = null;
	};

	const renderTypedToCanvas = async () => {
		const font = TYPE_FONTS.find((f) => f.id === fontId) || TYPE_FONTS[0];
		const canvas = document.createElement("canvas");
		canvas.width = 900;
		canvas.height = typedTitle.trim() ? 280 : 220;
		const ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = "#0f172a";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		// Ensure web fonts are ready
		try {
			await document.fonts.load(`700 ${font.size}px ${font.css}`);
			if (typedTitle.trim()) {
				await document.fonts.load(`500 22px Inter`);
			}
		} catch {
			/* ignore */
		}

		const name = (typedName || "Firma").trim();
		ctx.font = `700 ${font.size}px ${font.css}`;
		ctx.fillText(name, canvas.width / 2, typedTitle.trim() ? canvas.height / 2 - 18 : canvas.height / 2);

		if (typedTitle.trim()) {
			ctx.font = "500 22px Inter, system-ui, sans-serif";
			ctx.fillStyle = "#64748b";
			ctx.fillText(typedTitle.trim(), canvas.width / 2, canvas.height / 2 + 42);
		}

		// subtle underline
		ctx.strokeStyle = "#cbd5e1";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(120, canvas.height - 48);
		ctx.lineTo(canvas.width - 120, canvas.height - 48);
		ctx.stroke();

		return canvas.toDataURL("image/png");
	};

	const renderInitialsToCanvas = async () => {
		const text = (initials || "XX").trim().toUpperCase().slice(0, 4);
		const canvas = document.createElement("canvas");
		canvas.width = 520;
		canvas.height = 220;
		const ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		try {
			await document.fonts.load('700 96px "Great Vibes"');
		} catch {
			/* ignore */
		}
		ctx.fillStyle = "#0f172a";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = '700 96px "Great Vibes", cursive';
		ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 6);
		ctx.strokeStyle = "#cbd5e1";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(80, canvas.height - 40);
		ctx.lineTo(canvas.width - 80, canvas.height - 40);
		ctx.stroke();
		return canvas.toDataURL("image/png");
	};

	const canvasHasInk = () => {
		const canvas = canvasRef.current;
		if (!canvas) return false;
		const ctx = canvas.getContext("2d");
		const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
		for (let i = 3; i < data.length; i += 4) {
			if (data[i] > 10) return true;
		}
		return false;
	};

	const applySignature = async () => {
		if (!userId) {
			showToast?.("Sesión no disponible", "error");
			return;
		}
		setBusy(true);
		try {
			let dataUrl = null;
			if (mode === "draw") {
				if (!canvasHasInk()) {
					showToast?.("Dibuja tu firma primero", "error");
					return;
				}
				dataUrl = canvasRef.current.toDataURL("image/png");
			} else if (mode === "type") {
				if (!typedName.trim()) {
					showToast?.("Escribe un nombre para la firma", "error");
					return;
				}
				dataUrl = await renderTypedToCanvas();
			} else if (mode === "initials") {
				if (!initials.trim()) {
					showToast?.("Indica tus iniciales", "error");
					return;
				}
				dataUrl = await renderInitialsToCanvas();
			} else {
				showToast?.("Elige un archivo de imagen", "error");
				return;
			}

			const file = dataUrlToFile(dataUrl, `signature-${Date.now()}.png`);
			const url = await uploadProfileAsset(userId, file, "signature");
			if (!url) throw new Error("No se pudo subir la firma");
			onChangeUrl?.(url);
			await onPersist?.(url);
			showToast?.("Firma guardada");
		} catch (err) {
			console.error(err);
			showToast?.(err?.message || "Error al guardar la firma", "error");
		} finally {
			setBusy(false);
		}
	};

	const handleUpload = async (e) => {
		const f = e.target.files?.[0];
		if (!f || !userId) return;
		if (f.size > 3 * 1024 * 1024) {
			showToast?.("La imagen no puede superar 3 MB", "error");
			e.target.value = "";
			return;
		}
		setBusy(true);
		try {
			const url = await uploadProfileAsset(userId, f, "signature");
			if (!url) throw new Error("No se pudo subir la firma");
			onChangeUrl?.(url);
			await onPersist?.(url);
			showToast?.("Firma guardada");
		} catch (err) {
			showToast?.(err?.message || "Error al subir la firma", "error");
		} finally {
			setBusy(false);
			e.target.value = "";
		}
	};

	const clearSignature = async () => {
		onChangeUrl?.("");
		await onPersist?.(null);
		clearCanvas();
		showToast?.("Firma eliminada");
	};

	// Live typed/initials preview
	useEffect(() => {
		if (mode !== "type" && mode !== "initials") return;
		let cancelled = false;
		(async () => {
			const dataUrl =
				mode === "type" ? await renderTypedToCanvas() : await renderInitialsToCanvas();
			if (!cancelled && previewRef.current) {
				previewRef.current.src = dataUrl;
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode, typedName, typedTitle, fontId, initials]);

	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-start gap-4">
				<div className="shrink-0 w-full sm:w-44 h-28 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
					{valueUrl ? (
						<img
							src={valueUrl}
							alt="Firma actual"
							className="max-w-full max-h-full object-contain p-2"
						/>
					) : (
						<span className="text-xs text-slate-400 px-3 text-center">
							Sin firma guardada
						</span>
					)}
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold text-slate-900">Firma profesional</p>
					<p className="text-xs text-slate-500 mt-0.5 leading-snug">
						Se usa en consentimientos y PDFs que generes tú. Puedes dibujarla, escribirla,
						usar iniciales o subir una imagen.
					</p>
					{valueUrl && (
						<button
							type="button"
							onClick={clearSignature}
							disabled={busy}
							className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">
							<Trash2 size={13} /> Quitar firma actual
						</button>
					)}
				</div>
			</div>

			<div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-0.5 gap-0.5">
				{MODES.map((m) => {
					const Icon = m.icon;
					const active = mode === m.id;
					return (
						<button
							key={m.id}
							type="button"
							onClick={() => setMode(m.id)}
							className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-xs font-semibold transition-colors ${
								active
									? "bg-slate-900 text-white"
									: "text-slate-500 hover:text-slate-800"
							}`}>
							<Icon size={14} /> {m.label}
						</button>
					);
				})}
			</div>

			{mode === "draw" && (
				<div className="space-y-2">
					<div className="relative rounded-xl border border-dashed border-slate-300 bg-white overflow-hidden touch-none">
						<canvas
							ref={canvasRef}
							className="w-full h-44 cursor-crosshair block"
							onMouseDown={startDraw}
							onMouseMove={moveDraw}
							onMouseUp={endDraw}
							onMouseLeave={endDraw}
							onTouchStart={startDraw}
							onTouchMove={moveDraw}
							onTouchEnd={endDraw}
						/>
						<p className="absolute bottom-2 left-3 text-[10px] text-slate-400 pointer-events-none">
							Firma aquí con el ratón o el dedo
						</p>
					</div>
					<button
						type="button"
						onClick={clearCanvas}
						className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
						<Eraser size={13} /> Borrar trazo
					</button>
				</div>
			)}

			{mode === "type" && (
				<div className="space-y-3">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label className="block space-y-1">
							<span className="text-[11px] font-bold uppercase text-slate-500">
								Nombre en la firma
							</span>
							<input
								className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 bg-white"
								value={typedName}
								onChange={(e) => setTypedName(e.target.value)}
								placeholder="Dra. Ana López"
							/>
						</label>
						<label className="block space-y-1">
							<span className="text-[11px] font-bold uppercase text-slate-500">
								Cargo / título (opcional)
							</span>
							<input
								className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 bg-white"
								value={typedTitle}
								onChange={(e) => setTypedTitle(e.target.value)}
								placeholder="Médico estético · Nº col. 12345"
							/>
						</label>
					</div>
					<div className="flex flex-wrap gap-2">
						{TYPE_FONTS.map((f) => (
							<button
								key={f.id}
								type="button"
								onClick={() => setFontId(f.id)}
								className={`h-8 px-3 rounded-lg text-xs font-semibold border ${
									fontId === f.id
										? "border-slate-900 bg-slate-900 text-white"
										: "border-slate-200 bg-white text-slate-600"
								}`}>
								{f.label}
							</button>
						))}
					</div>
					<div className="rounded-xl border border-slate-200 bg-white h-36 flex items-center justify-center overflow-hidden">
						<img ref={previewRef} alt="Vista previa" className="max-h-full max-w-full object-contain" />
					</div>
				</div>
			)}

			{mode === "initials" && (
				<div className="space-y-3">
					<label className="block space-y-1 max-w-xs">
						<span className="text-[11px] font-bold uppercase text-slate-500">Iniciales</span>
						<input
							className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 bg-white uppercase tracking-widest font-semibold"
							value={initials}
							maxLength={4}
							onChange={(e) => setInitials(e.target.value.toUpperCase())}
							placeholder="AL"
						/>
					</label>
					<div className="rounded-xl border border-slate-200 bg-white h-36 flex items-center justify-center overflow-hidden">
						<img ref={previewRef} alt="Vista previa iniciales" className="max-h-full max-w-full object-contain" />
					</div>
				</div>
			)}

			{mode === "upload" && (
				<label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 cursor-pointer hover:bg-slate-50">
					<ImagePlus className="text-slate-400" size={22} />
					<span className="text-sm font-semibold text-slate-700">Elegir imagen de firma</span>
					<span className="text-xs text-slate-400">PNG o JPG transparente, máx. 3 MB</span>
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif"
						className="hidden"
						disabled={busy}
						onChange={handleUpload}
					/>
				</label>
			)}

			{mode !== "upload" && (
				<div className="flex justify-end">
					<button
						type="button"
						disabled={busy}
						onClick={applySignature}
						className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-bold hover:bg-slate-800 disabled:opacity-50">
						{busy ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
						Usar esta firma
					</button>
				</div>
			)}
		</div>
	);
}
