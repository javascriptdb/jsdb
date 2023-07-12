import {EventEmitter} from 'events';
import {route} from '../http/base.js';

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
export async function getEventStore(body) {
  // TODO : We should force the url to match the collection name etc, otherwise it could be a security problem
  const key = JSON.stringify(body);
  if (!storeByKey.has(key)) {
    // If the route fails, means they were not allowed to subscribe to this event
    const store = new CustomStore({
      value: route(body.url, body),
      body
    });
    storeByKey.set(key, store);
    if(body.collection){
      if (!storesByCollection.has(body.collection)) {
        storesByCollection.set(body.collection, new Set());
      }
      storesByCollection.get(body.collection).add(store);
    }
    if(body.id) {
      storeById.set(body.id, store);
    }
  }
}

export function emitChange(collection, id, document){
  if(id && storeById.has(id)) {
    storeById.get(id).set(document);
  }
  if(storesByCollection.has(collection)) {
    storesByCollection.get(collection).forEach(store => {
      const {body} = store.get();
      store.set(route(body.url, body));
    });
  }
};
