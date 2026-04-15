import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("OAuth2 Worker", () => {
	it("returns 404 for unknown routes", async () => {
		const response = await SELF.fetch("https://example.com/unknown");
		expect(response.status).toBe(404);
	});

	it("redirects /auth/login to Google OAuth", async () => {
		const response = await SELF.fetch(
			"https://example.com/auth/login?pwa_origin=http://localhost:5173",
			{ redirect: "manual" },
		);
		expect(response.status).toBe(302);
		const location = response.headers.get("Location") || "";
		expect(location).toContain("accounts.google.com");
	});
});
