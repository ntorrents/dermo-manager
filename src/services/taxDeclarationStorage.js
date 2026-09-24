import { supabase } from "./supabase";

const BUCKET = "tax-declarations";

export const buildTaxDeclarationPath = (userId, clinicId, model, year, period, filename) => {
	const safe = (filename || "declaracion.pdf").replace(/[^a-zA-Z0-9._-]+/g, "_");
	return `${userId}/${clinicId}/${model}-${year}-${period}-${safe}`;
};

export const uploadTaxDeclarationPdf = async (userId, clinicId, model, year, period, file) => {
	const path = buildTaxDeclarationPath(userId, clinicId, model, year, period, file.name);
	const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
		contentType: "application/pdf",
		upsert: true,
	});
	if (error) throw error;
	return path;
};

export const getTaxDeclarationDownloadUrl = async (storagePath) => {
	const { data, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(storagePath, 3600);
	if (error) throw error;
	return data?.signedUrl || null;
};

export const removeTaxDeclarationPdf = async (storagePath) => {
	if (!storagePath) return;
	const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
	if (error) throw error;
};
