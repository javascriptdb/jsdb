import _ from 'lodash-es';
import {functionToSelect, functionToWhere} from './parser.js';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';

export const db = new Database(process.env.SQLITE_DATABASE_PATH || './database.sqlite');
db.pragma('journal_mode = WAL;');
let preparedStatementMap = new Map();

const tablesCreated = new Map();

function dbCommand(cmd, sql, parameters = {}) {
  try {
    let statement;
    if (preparedStatementMap.has(sql)) {
      statement = preparedStatementMap.get(sql);
    } else {
      statement = db.prepare(sql);
      preparedStatementMap.set(sql, statement);
    }
    const data = statement[cmd](parameters);
    return {statement, data};
  } catch (e) {
    console.error(`Error running: ${sql}`, e);
  }
}

export function forceTable(collection) {
  if (tablesCreated.has(safe(collection))) return;
  dbCommand('run', `CREATE TABLE IF NOT EXISTS ${collection} (id TEXT PRIMARY KEY, value JSONB)`);
  tablesCreated.set(collection, true);
}

export function forceIndex(collection, index) {
  forceTable(collection);
  try {
    const indexName = safe(index.fields.join('.').replace(/\s+/g, '').trim());
    const columns = index.fields.map(field => {
      const parts = field.replace(/\s+/g, ' ').trim().split(' ');
      if (parts.length > 2) {
        throw new Error('Invalid field, must have form: path.to.property DESC');
      } else if (parts[1] !== undefined && !['ASC', 'DESC'].includes(parts[1])) {
        throw new Error('Invalid field, order should be ASC or DESC');
      }
      return `JSON_EXTRACT(value, '$.${safe(parts[0])}') ${safe(parts[1] || 'ASC')}`;
    }).join(',');
    dbCommand('run', `CREATE UNIQUE INDEX IF NOT EXISTS '${indexName}' ON ${collection} (${columns})`);
  } catch (e) {
    console.error(e);
  }
}

function rowDataToObject(data) {
  return {id: data.id, ...JSON.parse(data.value)};
}

function rowsToObjects(rows) {
  return rows.map(rowDataToObject);
}

export const opHandlers = {
  getTables() {
    const result = dbCommand('all', `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    return (result.data || []).map(table => table.name);
  },
  getAll({collection}) {
    forceTable(collection);
    const result = dbCommand('all', `SELECT * FROM ${collection}`);
    return rowsToObjects(result.data || []);
  },
  slice({collection, start, end}) {
    forceTable(collection);
    const result = dbCommand('all', `SELECT * FROM ${collection} LIMIT $limit OFFSET $offset`, {
      offset: start,
      limit: end - start
    });
    return rowsToObjects(result.data || []);
  },
  get({collection, id, path = []}) {
    forceTable(collection);
    if (path.length > 0) {
      const result = dbCommand('get', `SELECT id, json_extract(value, '$.${safe(path.join('.'))}') as value FROM ${collection} WHERE id = $id`, {
        id
      });
      return result.data?.value;
    } else {
      const result = dbCommand('get', `SELECT id,value FROM ${collection} WHERE id = $id`, {
        id
      });
      return result.data && rowDataToObject(result.data);
    }
  },
  set({collection, id = crypto.randomUUID(), value, path = []}) {
    forceTable(collection);
    const insertSegment = `INSERT INTO ${collection} (id,value) VALUES ($id,json($value))`;
    let result;
    if (path.length > 0) {
      // Make new object from path
      const object = _.set({}, path, value);
      result = dbCommand('run', `${insertSegment} ON CONFLICT (id) DO UPDATE SET value = json_set(value,'$.${safe(path.join('.'))}',json($nestedValue))`, {
        id,
        value: JSON.stringify(object),
        nestedValue: JSON.stringify(value)
      });
    } else {
      result = dbCommand('run', `${insertSegment} ON CONFLICT (id) DO UPDATE SET value = $value`, {
        id,
        value: JSON.stringify(value)
      });
    }
    // const inserted = result?.statement?.changes === 0;
    return id;
  },
  push({collection, value}) { // Keeping this separate so we can have independent rules for pushing than setting
    return this.set({collection, value});
  },
  delete({collection, id, path = []}) {
    forceTable(collection);
    if (path.length > 0) {
      const result = dbCommand('run', `UPDATE ${collection} SET value = json_remove(value,'$.${safe(path.join('.'))}') WHERE id = $id`, {
        id
      });
      return result.data.changes > 0;
    } else {
      const result = dbCommand('run', `DELETE FROM ${collection} WHERE id = $id`, {
        id
      });
      return result.data.changes > 0;
    }
  },
  has({collection, id}) {
    forceTable(collection);
    const result = dbCommand('get', `SELECT EXISTS(SELECT id FROM ${collection} WHERE id = $id) as found`, {
      id
    });
    return result?.data.found > 0;
  },
  keys({collection}) {
    forceTable(collection);
    const result = dbCommand('all', `SELECT id FROM ${collection}`);
    return result?.data?.map(r => r.id);
  },
  size({collection}) {
    forceTable(collection);
    const result = dbCommand('get', `SELECT COUNT(id) as count FROM ${collection}`);
    return result?.data?.count || 0;
  },
  clear({collection}) {
    forceTable(collection);
    dbCommand('run', `DROP TABLE ${collection}`);
    tablesCreated.delete(collection);
    return true;
  },
  filter({collection, operations}) {
    forceTable(collection);
    const lengthOp = operations.find(op => op.type === 'length');
    const mapOp = operations.find(op => op.type === 'map');
    let parsedSelect;
    if(mapOp) {
      parsedSelect = functionToSelect(mapOp.data.callbackFn, mapOp.data.thisArg, collection);
    }
    // Count takes precedence over map
    let query = `SELECT ${lengthOp?'COUNT(*) as count':mapOp?parsedSelect.select:'*'} FROM ${collection}`;
    let queryParams = {};

    // WHERE
    operations.filter(op => op.type === 'filter').forEach(op => {
      const parsedWhere = functionToWhere(op.data.callbackFn, op.data.thisArg, collection);
      query += ` WHERE ${parsedWhere.query} `;
      queryParams = {...queryParams, ...parsedWhere.whereQueryParams};
    });

    const orderBy = operations.filter(op => op.type === 'orderBy').map(op => `json_extract(value,'$.${safe(op.data.property)}') ${safe(op.data.order)}`).join(' ');
    if (orderBy) query += ` ORDER BY ${orderBy} `;

    const sliceOp = operations.find(op => op.type === 'slice');
    if (sliceOp) {
      query += ` LIMIT $limit OFFSET $offset `;
      queryParams.offset = sliceOp?.data.start;
      queryParams.limit = sliceOp?.data.end - sliceOp?.data.start;
    }
    if (lengthOp) {
      // Return without running map operation, doesn't make sense to waste time mapping and then counting.
      const result = dbCommand('get', query, queryParams);
      return result?.data?.count;
    } else {
      const result = dbCommand('all', query, queryParams);

      if (mapOp) {
        return processMapResult(result, parsedSelect.singleValue);
      } else {
        const objects = rowsToObjects(result.data || []);
        return objects;
      }
    }
  },
  find({collection, callbackFn, thisArg}) {
    forceTable(collection);
    const parsedWhere = functionToWhere(callbackFn, thisArg, collection);
    const query = `SELECT * FROM ${collection} WHERE ${parsedWhere.query} LIMIT 1`;
    const result = dbCommand('all', query, parsedWhere.whereQueryParams);
    return result.data[0] && rowDataToObject(result.data[0]);
  },
  map({collection, callbackFn, thisArg}) {
    forceTable(collection);

    const {select, singleValue} = functionToSelect(callbackFn, thisArg, collection);
    const query = `SELECT ${select} FROM ${collection}`;
    const result = dbCommand('all', query);
    return processMapResult(result, singleValue);
  }
};

function processMapResult (result, singleValue) {
  if (singleValue) {
    return (result.data || []).map(data => {
      try {
        return JSON.parse(data.value);
      } catch (e) {
        return data.value;
      }
    });
  } else {
    return (result.data || []).map(data => {
      const result = {id: data.id};
      Object.keys(data).forEach(key => {
        if (key !== 'id') {
          try {
            result[key] = JSON.parse(data[key]);
          } catch (e) {
            result[key] = data[key];
          }
        }
      });
      return result;
    });
  }
}

export function safe(string) {
  if (!/^\w+$/.test(string.replaceAll('.', ''))) {
    throw new Error(`Unsafe string (${string}). Only alphanumerical chars allowed.`);
  }
  return string;
}

global.opHandlers = opHandlers;