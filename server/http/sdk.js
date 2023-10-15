import {initApp} from "@jsdb/sdk";
export let sdkApp, sdkDb;
export async function initSdk() {
  sdkApp = await initApp({serverUrl: process.env.SERVER_URL, connector: 'HTTP'})
  sdkDb = sdkApp.db;
}
