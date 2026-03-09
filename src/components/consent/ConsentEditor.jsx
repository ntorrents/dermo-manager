import React, { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Upload } from "lucide-react";
import mammoth from "mammoth";

const ConsentEditor = ({ value = "", onChange, placeholder, disabled }) => {
	const fileInputRef = useRef(null);

	const editor = useEditor({
		extensions: [StarterKit],
		content: value || "",
		editorProps: {
			attributes: {
				class:
					"min-h-[280px] max-h-[50vh] overflow-y-auto p-4 bg-gray-50 rounded-xl border-2 border-transparent focus:bg-white focus:border-rose-100 outline-none prose prose-sm max-w-none",
			},
			handleDOMEvents: {
				blur: (view, event) => {
					onChange?.(editor.getHTML());
				},
			},
		},
	});

	useEffect(() => {
		if (editor && value !== undefined && value !== editor.getHTML()) {
			editor.commands.setContent(value || "", false);
		}
	}, [value, editor]);

	useEffect(() => {
		if (!editor) return;
		const onUpdate = () => onChange?.(editor.getHTML());
		editor.on("update", onUpdate);
		return () => editor.off("update", onUpdate);
	}, [editor, onChange]);

	const handleImportDocx = async (e) => {
		const file = e.target.files?.[0];
		if (!file || !file.name.toLowerCase().endsWith(".docx")) return;
		try {
			const arrayBuffer = await file.arrayBuffer();
			const result = await mammoth.convertToHtml({ arrayBuffer });
			editor?.commands.setContent(result.value || "", false);
			onChange?.(result.value || "");
		} catch (err) {
			console.error(err);
			onChange?.(""); // trigger error in parent if needed
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	if (!editor) return null;

	return (
		<div className="border-2 border-gray-100 rounded-xl overflow-hidden focus-within:border-rose-100 bg-gray-50 focus-within:bg-white transition-colors">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100 bg-white">
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleBold().run()}
					className={`p-2 rounded-lg transition-colors ${editor.isActive("bold") ? "bg-rose-100 text-rose-700" : "text-gray-500 hover:bg-gray-100"}`}
					title="Negrita">
					<Bold size={18} />
				</button>
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleItalic().run()}
					className={`p-2 rounded-lg transition-colors ${editor.isActive("italic") ? "bg-rose-100 text-rose-700" : "text-gray-500 hover:bg-gray-100"}`}
					title="Cursiva">
					<Italic size={18} />
				</button>
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					className={`p-2 rounded-lg transition-colors ${editor.isActive("underline") ? "bg-rose-100 text-rose-700" : "text-gray-500 hover:bg-gray-100"}`}
					title="Subrayado">
					<UnderlineIcon size={18} />
				</button>
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					className={`p-2 rounded-lg transition-colors ${editor.isActive("bulletList") ? "bg-rose-100 text-rose-700" : "text-gray-500 hover:bg-gray-100"}`}
					title="Lista">
					<List size={18} />
				</button>
				<button
					type="button"
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					className={`p-2 rounded-lg transition-colors ${editor.isActive("orderedList") ? "bg-rose-100 text-rose-700" : "text-gray-500 hover:bg-gray-100"}`}
					title="Lista numerada">
					<ListOrdered size={18} />
				</button>
				<span className="w-px h-6 bg-gray-200 mx-1" />
				<input
					ref={fileInputRef}
					type="file"
					accept=".docx"
					className="hidden"
					onChange={handleImportDocx}
				/>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center gap-1.5 text-sm font-bold"
					title="Importar desde Word (.docx)">
					<Upload size={18} />
					<span className="hidden sm:inline">Importar .docx</span>
				</button>
			</div>
			<EditorContent editor={editor} />
		</div>
	);
};

export default ConsentEditor;
