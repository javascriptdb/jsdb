import {resolveMiddlewareFunction, rules, triggers} from '../lifecycleMiddleware.js';
import {opHandlers} from "../opHandlersBetterSqlite.js";
import {realtimeListeners} from '../ws/ws.js';

// TODO : User context

async function runSecurityRules(operation, body) {
  const ruleFunction = resolveMiddlewareFunction('rules', body.collection, operation);
  if (!ruleFunction) {
    console.warn(`No rule defined for ${body.collection} operation ${operation}`);
  } else {
    try {
      const ruleResult = await ruleFunction({...body, user: {}});
      if (!ruleResult) {
        return {error: new Error('Unauthorized!'), statusCode: 401};
      }
    } catch (error) {
      return {error, statusCode: 401};
    }
  }
}

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
    const documentData = opHandlers.get({collection:body.collection,id: result.insertedId});
    realtimeListeners.emit(body.collection, {event: 'add', document: documentData})
    return {value: result.insertedId};
  },
  'size' : (body) => {
    const count = opHandlers.size(body);
    return {value: count};
  },

  'clear': (body) => {
    opHandlers.clear(body);
    // TODO : AI generated this line
    // realtimeListeners.emit(body.collection, {event: 'clear', document: null})
    return true;
  },
  'delete': (body) => {
    const wasDeleted = opHandlers.delete(body);
    // TODO : AI generated this line
    // realtimeListeners.emit(body.collection, {event: 'delete', document: body.id})
    return {value: wasDeleted};
  },
  'set': (body) => {
    const result = opHandlers.set(body);
    const documentData = opHandlers.get(body);
    if (result.inserted) { // It was new
      realtimeListeners.emit(body.collection, {event: 'add', document: documentData})
    } else { //Modified existing one
      realtimeListeners.emit(body.collection, {event: 'edit', document: documentData})
    }
    realtimeListeners.emit(`${body.collection}.${body.id}`, {document: documentData})
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
  await runSecurityRules(operation, body);
  try {
    const result = operations[operation](body);
    setTimeout(() => {
      executeTrigger(operation, body, result)
    })
    return result;
  } catch (e) {
    return {error: e.message};
  }
}

function executeTrigger(operation, body, result) {
  const triggerFunction = resolveMiddlewareFunction('triggers', body.collection, operation)
  try {
    triggerFunction?.({...body, user: {}, result});
  } catch (e) {
    console.error(e);
  }
}