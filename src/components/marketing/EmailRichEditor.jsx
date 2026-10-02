import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
	Bold,
	Heading2,
	ImageIcon,
	Italic,
	Link2,
	List,
	ListOrdered,
} from "lucide-react";

/**
 * Editor TipTap para correos (títulos, negrita, cursiva, listas, enlaces, imágenes).
 * StarterKit v3 ya trae Link → lo desactivamos y registramos el nuestro una sola vez.
 */
export const EmailRichEditor = ({ value = "", onChange, disabled = false }) => {
	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: { levels: [2, 3] },
				// Evita "Duplicate extension names found: ['link']"
				link: false,
			}),
			Link.configure({
				openOnClick: false,
				autolink: true,
				HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
			}),
			Image.configure({ inline: false, allowBase64: true }),
		],
		content: value || "",
		editable: !disabled,
		editorProps: {
			attributes: {
				class:
					"min-h-[220px] max-h-[45vh] overflow-y-auto p-4 bg-gray-50 rounded-b-xl outline-none prose prose-sm max-w-none",
			},
		},
		onUpdate: ({ editor: ed }) => {
			onChange?.(ed.getHTML());
		},
	});

	useEffect(() => {
		if (!editor || editor.isDestroyed) return;
		const current = editor.getHTML();
		if (value !== undefined && value !== current) {
			editor.commands.setContent(value || "", { emitUpdate: false });
		}
	}, [value, editor]);

	useEffect(() => {
		if (!editor || editor.isDestroyed) return;
		editor.setEditable(!disabled);
	}, [editor, disabled]);

	if (!editor) return null;

	const setLink = () => {
		const prev = editor.getAttributes("link").href;
		const url = window.prompt("URL del enlace", prev || "https://");
		if (url === null) return;
		if (url === "") {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
	};

	const setImage = () => {
		const url = window.prompt("URL de la imagen");
		if (!url) return;
		editor.chain().focus().setImage({ src: url }).run();
	};

	const btn = (active, onClick, title, children) => (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			title={title}
			className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
				active ? "bg-rose-100 text-rose-700" : "text-gray-500 hover:bg-gray-100"
			}`}>
			{children}
		</button>
	);

	return (
		<div className="border-2 border-gray-100 rounded-xl overflow-hidden bg-white">
			<div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100 bg-white">
				{btn(
					editor.isActive("heading", { level: 2 }),
					() => editor.chain().focus().toggleHeading({ level: 2 }).run(),
					"Título",
					<Heading2 size={18} />,
				)}
				{btn(
					editor.isActive("bold"),
					() => editor.chain().focus().toggleBold().run(),
					"Negrita",
					<Bold size={18} />,
				)}
				{btn(
					editor.isActive("italic"),
					() => editor.chain().focus().toggleItalic().run(),
					"Cursiva",
					<Italic size={18} />,
				)}
				{btn(
					editor.isActive("bulletList"),
					() => editor.chain().focus().toggleBulletList().run(),
					"Lista",
					<List size={18} />,
				)}
				{btn(
					editor.isActive("orderedList"),
					() => editor.chain().focus().toggleOrderedList().run(),
					"Lista numerada",
					<ListOrdered size={18} />,
				)}
				{btn(editor.isActive("link"), setLink, "Enlace", <Link2 size={18} />)}
				{btn(false, setImage, "Imagen", <ImageIcon size={18} />)}
			</div>
			<EditorContent editor={editor} />
		</div>
	);
};
