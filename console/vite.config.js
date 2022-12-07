import { sveltekit } from '@sveltejs/kit/vite';
import {viteCommonjs} from "@originjs/vite-plugin-commonjs";

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
};

export default config;
