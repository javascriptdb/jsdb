import {resolveMiddlewareFunction, rules, triggers} from '../lifecycleMiddleware.js';
import {opHandlers} from "../opHandlersBetterSqlite.js";
import {realtimeListeners} from '../ws/ws.js';

// TODO : User context

async function runSecurityRules(operation, body, before) {
  const ruleFunction = resolveMiddlewareFunction('rules', body.collection, operation);
  if (!ruleFunction) {
    console.warn(`No rule defined for ${body.collection} operation ${operation}`);
  } else {
    try {
      const ruleResult = await ruleFunction({...body, user: {}, before});
      if (!ruleResult) {
        return {error: new Error('Unauthorized!'), statusCode: 401};
      }
    } catch (error) {
      return {error, statusCode: 401};
    }
  }
}

const operationsWithSideEffects = ['push', 'set', 'delete', 'clear'];

const operations = {
  'getTables': (body) => {
    const result = opHandlers.getTables();
    return result;
  },
  'filter': (body) => {
    const result = opHandlers.filter(body);
    return {value: result};
  },
  'find': (body) => {
    const result = opHandlers.find(body);
    return {value: result || null};
  },
  'map':  (body) => {
    const result = opHandlers.map(body);
    return result;
  },
  'getAll': (body) => {
    const result = opHandlers.getAll(body);
    return result;
  },
  'slice': (body) => {
    const result = opHandlers.slice(body);
    return result || [];
  },
  'has' : (body) => {
    const exists = opHandlers.has(body);
    return {value: exists};
  },
  'keys': (body) => {
    const ids = opHandlers.keys(body);
    return ids;
  },
  'push': (body) => {
    const result = opHandlers.set(body);
    return {value: result.insertedId};
  },
  'size' : (body) => {
    const count = opHandlers.size(body);
    return {value: count};
  },
  'clear': (body) => {
    opHandlers.clear(body);
    return true;
  },
  'delete': (body) => {
    const wasDeleted = opHandlers.delete(body);
    return {value: wasDeleted};
  },
  'set': (body) => {
    const result = opHandlers.set(body);
    return true;
  },
  'get' : (body) => {
    const result = opHandlers.get(body);
    return {value: result};
  }
}
operations.forEach = operations.getAll;
operations.entries = operations.getAll;
operations.values = operations.getAll;
operations.length = operations.size;

export async function routeDb(operation, body) {
  let before, after = undefined;
  if(body.id) {
    // TODO : only get the document if there is a security rule or trigger that actually uses it, we could use acorn
    before = opHandlers.get(body);
  }

  await runSecurityRules(operation, body, before);
  try {
    const result = operations[operation](body);
    if(operationsWithSideEffects.includes(operation)) {
      if (body.id) {
        after = opHandlers.get(body);
        realtimeListeners.emit(`${body.collection}.${body.id}`, {event: 'edit', document: afterDocumentData})
      }
      realtimeListeners.emit(body.collection, {operation})
    }
    setTimeout(() => {
      executeTrigger(operation, body, result)
    })
    return result;
  } catch (error) {
    return {error};
  }
}

function executeTrigger(operation, body, result, before, after) {
  const triggerFunction = resolveMiddlewareFunction('triggers', body.collection, operation)
  try {
    triggerFunction?.({...body, user: {}, result, before, after});
  } catch (e) {
    console.error(e);
  }
}