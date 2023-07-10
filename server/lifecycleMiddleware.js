import path from "path";
import url from "url";
import fsPromises from "fs/promises";
import operationFallback from "./operationFallback.js";
import {forceIndex} from "./opHandlersBetterSqlite.js";

export const triggers = {};
export const rules = {};
export const functions = {};
export const indexes = {};

export function resolveMiddlewareFunction(middlewareType, collection, operation) {
  let object = middlewareType === 'rules' ? rules : triggers;
  const resolvedFunction = object[collection]?.[operation]
      || rules[collection]?.[operationFallback[operation]]
      || rules[collection]?.default
      || rules.default?.[operation]
      || rules.default?.[operationFallback[operation]]
      || rules.default?.default;
  return resolvedFunction;
}

export async function importFromPath(extractedBundlePath) {
    const dbCollectionDirs = await fsPromises.readdir(path.resolve(extractedBundlePath, 'db'));
    dbCollectionDirs.push('default');
    await Promise.all(dbCollectionDirs.map(async collectionDir => {
        try {
            rules[collectionDir] = await import(path.resolve(extractedBundlePath, 'db', collectionDir, 'rules.js'))
        } catch (e) {
            if (e.code !== 'ERR_MODULE_NOT_FOUND') console.error(e)
        }
        try {
            triggers[collectionDir] = await import(path.resolve(extractedBundlePath, 'db', collectionDir, 'triggers.js'))
        } catch (e) {
            if (e.code !== 'ERR_MODULE_NOT_FOUND') console.error(e)
        }
        try {
            indexes[collectionDir] = (await import(path.resolve(extractedBundlePath, 'db', collectionDir, 'indexes.json'),{assert: {type: 'json'}})).default
            indexes[collectionDir].map(async index => await forceIndex(collectionDir,index))
        } catch (e) {
            if (e.code !== 'ERR_MODULE_NOT_FOUND') console.error(e)
        }
    }));

    try {
        const functionFileNames = (await fsPromises.readdir(path.resolve(extractedBundlePath, 'functions')))
            .filter(name => name.includes('.js'));
        await Promise.all(functionFileNames.map(async (functionFileName) => {
            try {
                const functionName = functionFileName.replace('.js', '');
                functions[functionName] = await import(path.resolve(extractedBundlePath, 'functions', functionFileName));
            } catch (e) {
                console.error(e);
            }
        }));
    } catch (e) {
        if (e.code !== 'ENOENT') console.error(e);
    }

    const bundleHostingPath = path.resolve(extractedBundlePath, 'hosting')
    const serverHostingPath = path.resolve(process.cwd(), '.jsdb', 'hosting')
    console.log({rules, triggers, functions, indexes});
    try {
        if (bundleHostingPath !== serverHostingPath) {
            console.log('Copy hosting from', bundleHostingPath, serverHostingPath);
            await fsPromises.cp(bundleHostingPath, serverHostingPath, {recursive: true, force: true});
        }
    } catch (e) {
        if (e.code !== 'ENOENT') console.error(e);
    }
}


const defaultsPath = path.resolve(url.fileURLToPath(import.meta.url), '../.jsdb');

await importFromPath(defaultsPath);
