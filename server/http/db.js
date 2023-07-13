import {resolveMiddlewareFunction, rules, triggers} from '../lifecycleMiddleware.js';
import {opHandlers} from "../opHandlersBetterSqlite.js";
import {emitChange, realtimeListeners} from '../ws/ws.js';

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

export async function routeDb(operation, body) {
  let before, after = undefined;
  if(body.id) {
    // TODO : only get the document if there is a security rule or trigger that actually uses it, we could use acorn
    before = opHandlers.get({collection: body.collection, id: body.id});
  }

  await runSecurityRules(operation, body, before);
  try {
    const result = opHandlers[operation](body);
    if(operationsWithSideEffects.includes(operation)) {
      if (body.id) {
        after = opHandlers.get({collection: body.collection, id: body.id});
        // emitChange(body.collection, body.id, body.value);
      }
      emitChange(body.collection, undefined)
    }
    setTimeout(() => {
      executeTrigger(operation, body, result, before, after)
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