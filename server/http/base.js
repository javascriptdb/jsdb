import {routeDb} from './db.js';
import {functions} from '../lifecycleMiddleware.js';
import {routeStorage} from './storage.js';

export async function route(path, body, user, skipSecurityRules, skipTrigger) {
  // TODO : on every request we should get the JWT token from the header, decode it and pass it to every route
  // const authorization = req.get('Authorization');
  // const bearer = authorization?.replaceAll('Bearer ','');
  const [, module, operation] = path.split('/');
  if (module === 'db') {
    return await routeDb(operation, body, user, skipSecurityRules, skipTrigger);
  } else if (module === 'functions') {
    const fn = functions[operation]?.default;
    if (fn) {
      return await fn({user: {}, data: body});
    } else {
      return {statusCode: 404, error: new Error('Remote function not found.')};
    }
  } else if (module === 'storage') {
    return routeStorage(operation, body);
  }
}