const enc = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
	return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signOAuthState(
	userId: string,
	clinicId: string,
	secret: string,
): Promise<string> {
	const payload = JSON.stringify({
		sub: userId,
		clinicId,
		exp: Date.now() + 15 * 60 * 1000,
	});
	const sig = await hmacHex(payload, secret);
	return `${btoa(payload)}.${sig}`;
}

export async function parseOAuthState(
	state: string,
	secret: string,
): Promise<{ sub: string; clinicId: string } | null> {
	try {
		const [b64, sigHex] = state.split(".");
		if (!b64 || !sigHex) return null;
		const payload = atob(b64);
		const expected = await hmacHex(payload, secret);
		if (expected !== sigHex) return null;
		const obj = JSON.parse(payload) as { sub?: string; clinicId?: string; exp?: number };
		if (!obj.sub || !obj.clinicId || typeof obj.exp !== "number") return null;
		if (obj.exp < Date.now()) return null;
		return { sub: obj.sub, clinicId: obj.clinicId };
	} catch {
		return null;
	}
}
