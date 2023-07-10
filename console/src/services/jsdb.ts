import {initApp} from "@jsdb/sdk";

export const {auth, db} = await initApp({serverUrl: 'http://localhost:3001', connector: 'HTTP'})