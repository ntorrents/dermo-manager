import { generateInvoice } from "./invoiceGenerator";

export function buildInvoiceMailto({ client, entry, clinicName = "Clínica" }) {
	const email = client?.email?.trim();
	if (!email) return null;
	const num = entry?.invoice_number || "";
	const subject = encodeURIComponent(`Factura ${num} — ${clinicName}`);
	const name = [client.name, client.surname].filter(Boolean).join(" ").trim() || "cliente";
	const body = encodeURIComponent(
		`Estimado/a ${name},\n\nLe enviamos la factura ${num} correspondiente a su tratamiento.\n\nPor favor, revise el PDF adjunto.\n\nUn saludo cordial,\n${clinicName}`,
	);
	return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}

/** Descarga PDF y abre el cliente de correo si hay email. */
export async function shareInvoicePdfAndEmail({
	entry,
	client,
	clinic,
	profile,
	isAbono = false,
	clinicName,
}) {
	await generateInvoice(entry, client, clinic, profile, { isAbono });
	const mailto = buildInvoiceMailto({ client, entry, clinicName: clinicName || clinic?.name });
	if (mailto && typeof window !== "undefined") {
		window.location.href = mailto;
		return { downloaded: true, emailed: true };
	}
	return { downloaded: true, emailed: false };
}
