import {routeDb} from './db.js';
import {functions} from '../lifecycleMiddleware.js';

const regexpIsoDate = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/;

export async function route(url, bodyString) {
  // TODO : on every request we should get the JWT token from the header, decode it and pass it to every route
  // const authorization = req.get('Authorization');
  // const bearer = authorization?.replaceAll('Bearer ','');
  const [,module, operation] = url.split('/');
  const body = JSON.parse(bodyString, (key, value) => {
    if(regexpIsoDate.test(value)) {
      return new Date(value);
    } else {
      return value;
    }
  });
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