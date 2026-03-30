/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_HEALTH_API_URL?: string;
	readonly VITE_HEALTH_API_KEY?: string;
	readonly VITE_HEALTH_SERVER_URL?: string;
	readonly VITE_HEALTH_PROXY_TARGET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
