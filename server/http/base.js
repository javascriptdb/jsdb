import {routeDb} from './db.js';
import {functions} from '../lifecycleMiddleware.js';
import {parseData} from '../utils.js';

export async function route(path, bodyString, parsedBody) {
  // TODO : on every request we should get the JWT token from the header, decode it and pass it to every route
  // const authorization = req.get('Authorization');
  // const bearer = authorization?.replaceAll('Bearer ','');
  const [,module, operation] = path.split('/');
  const body = parsedBody || parseData(bodyString);
  if(module === 'db') {
    return await routeDb(operation, body);
  } else if (module === 'functions') {
    const fn = functions[operation]?.default;
    if(fn) {
      return await fn({user: {}, data: body})
    } else {
      return {statusCode: 404, error: new Error('Remote function not found.')}
    }
  }
}