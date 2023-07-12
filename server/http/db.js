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

export async function routeDb(operation, body) {
  let before, after = undefined;
  if(body.id) {
    // TODO : only get the document if there is a security rule or trigger that actually uses it, we could use acorn
    before = opHandlers.get(body);
  }

  await runSecurityRules(operation, body, before);
  try {
    const result = opHandlers[operation](body);
    if(operationsWithSideEffects.includes(operation)) {
      if (body.id) {
        after = opHandlers.get(body);
        realtimeListeners.emit(`${body.collection}.${body.id}`, {event: 'edit', document: after})
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