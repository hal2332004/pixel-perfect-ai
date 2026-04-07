/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_HEALTH_API_URL?: string;
	readonly VITE_HEALTH_API_KEY?: string;
	readonly VITE_HEALTH_SERVER_URL?: string;
	readonly VITE_HEALTH_PROXY_TARGET?: string;
	readonly VITE_CONNECT_API_URL?: string;
	readonly VITE_CONNECT_API_KEY?: string;
	readonly VITE_CONNECT_SERVER_URL?: string;
	readonly VITE_SR_API_URL?: string;
	readonly VITE_SR_API_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
