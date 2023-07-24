import {EventEmitter} from 'events';
import {route} from '../http/base.js';
import _ from 'lodash-es';

export const realtimeListeners = new EventEmitter();

export class CustomStore {
  value = undefined;
  subscriptions = new Set();

  constructor(initialValue) {
    this.value = initialValue;
  }

  unsubscribe(callback) {
    this.subscriptions.delete(callback);
    // TODO : Clear store & data if no more subscribers
  }

  subscribe(callback) {
    if (typeof callback !== 'function') throw new Error('Subscribe parameter must be a function.');
    this.subscriptions.add(callback);
    // TODO : we used to have it deferred to next tick, do we need this in the server?
    // setTimeout(() => callback(this.value));
    callback(this.value);
    return () => this.unsubscribe(callback);
  }

  set(value) {
    this.value = value;
    this.notify(this.value);
  }

  update(callback) {
    if (typeof callback !== 'function') throw new Error('Update parameter must be a function.');
    this.value = callback(this.value);
    this.notify(this.value);
  }

  notify(value) {
    this.subscriptions.forEach(callback => callback(value));
  }
}

let storeByKey = new Map();
let storesByCollection = new Map();
let storeById = new Map();
export async function getEventStore(body, user) {
  // TODO : We should force the url to match the collection name etc, otherwise it could be a security problem
  const key = JSON.stringify(body);
  if (!storeByKey.has(key)) {
    // If the route fails, means they were not allowed to subscribe to this event
    const store = new CustomStore({
      value: await route(body.url, body, user, false, false),
      body
    });
    storeByKey.set(key, store);
    if(body.collection){
      if (!storesByCollection.has(body.collection)) {
        storesByCollection.set(body.collection, new Set());
      }
      storesByCollection.get(body.collection).add(store);
    }
    return store;
  } else {
    return storeByKey.get(key)
  }

}

export const emitChange = _.debounce(function emitChange(collection){
  if(storesByCollection.has(collection)) {
    storesByCollection.get(collection).forEach(async store => {
      const {body} = store.value;
      // TODO : only do the DB operation, don't do security & triggers here
      const value = await route(body.url, body, null, true, true)
      store.set({value, body});
    });
  }
},50);
