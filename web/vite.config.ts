import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import compression from "vite-plugin-compression";

const serverPort = process.env.SERVER_PORT || "8080";

// https://vite.dev/config/
export default defineConfig({
	clearScreen: false,
	plugins: [
		react(),
		tailwindcss(),
		// Pre-compress JS/CSS for server-side gzip serving.
		// deleteOriginFile reduces embed binary size; server falls back to index.html for SPA routes.
		compression({
			algorithm: "gzip",
			ext: ".gz",
			filter: /\.(js|css)$/i,
			deleteOriginFile: true,
		}),
	],
	server: {
		allowedHosts: [".local.pockode.com", ".cloud.pockode.com"],
		proxy: {
			"/api": {
				target: `http://localhost:${serverPort}`,
				changeOrigin: true,
			},
			"/ws": {
				target: `ws://localhost:${serverPort}`,
				ws: true,
			},
		},
	},
});
