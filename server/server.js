

import { WebSocketServer } from 'ws';
import 'dotenv/config'

import EventEmitter from 'events';
import _ from 'lodash-es';
import {
  functions,
  importFromBase64,
  importFromPath, indexes,
  resolveMiddlewareFunction,
  rules,
  triggers
} from "./lifecycleMiddleware.js";
import {opHandlers} from "./opHandlersBetterSqlite.js";
import jwt from "jsonwebtoken";

const wsServer = new WebSocketServer({ noServer: true });
const realtimeListeners = new EventEmitter();

// TODO : move this somewhere proper

wsServer.on('connection', socket => {
  socket.on('message', async message => {
    try {
      const parsedMessage = JSON.parse(message);
      try {
        let token;
        const bearer = parsedMessage.authorization?.replace('Bearer ','').replace('undefined','');
        if(bearer) {
            token = jwt.verify(bearer, process.env.JWT_SECRET);
        }
        const ruleFunction = await resolveMiddlewareFunction('rules', parsedMessage.collection, parsedMessage.operation);
        const ruleResult = await ruleFunction({...parsedMessage, user: token?.user})
        if (ruleResult) {
          // TODO : How do we pass this along for the full duration of the subscription
          // req.excludeFields = ruleResult?.excludeFields;
          // req.where = ruleResult?.where;
        } else {
          return socket.send(JSON.stringify({
            operation: 'error',
            context: message,
            message: 'Unauthorized!'
          }));
        }
      } catch (e) {
        console.error(e);
        return socket.send(JSON.stringify({
          operation: 'error',
          context: message,
          message: e.message
        }));
      }

      if(parsedMessage.operation === 'get') {
        const {collection, id, path = [], operation} = parsedMessage;
        const eventName = `${collection}.${id}`;
        function documentChangeHandler(documentData) {
          let value;
          if(path.length > 0) {
            value = _.get(documentData, path);
          } else {
            value = documentData;
          }
          socket.send(JSON.stringify({
            fullPath: `${collection}.${id}` + (path.length > 0 ?  `.${path.join('.')}` : ''),
            value,
            operation,
            content: 'value'
          }));
        }
        const document = opHandlers.get({collection, id})
        documentChangeHandler(document)
        realtimeListeners.on(eventName, documentChangeHandler)
      } else if (parsedMessage.operation === 'filter') {
        const {collection, operations, operation, eventName} = parsedMessage;
        const serverEventName = collection;
        async function collectionChangeHandler(changeData) {
          if(changeData.event === 'drop') {
            socket.send(JSON.stringify({
              content: changeData.event,
              operation,
              eventName
            }));
          } else {
            try {
              const filteredResult = opHandlers.filter({collection, operations});
              socket.send(JSON.stringify({
                content: 'reset',
                value: filteredResult,
                eventName,
                operation,
                collection
              }))
            } catch (e) {
              console.error('Error running filter')
            }
          }
        }
        try {
          const filteredResult = opHandlers.filter({collection, operations});
          socket.send(JSON.stringify({
            content: 'reset',
            value: filteredResult,
            eventName,
            operation,
            collection
          }))
          realtimeListeners.on(serverEventName, collectionChangeHandler)
        } catch (e) {
          console.error('Error running filter')
        }

      } else if(parsedMessage.operation === 'push') {
        const {collection, operation, eventName} = parsedMessage;
        const id = opHandlers.set(parsedMessage);
        socket.send(JSON.stringify({
          value: id,
          eventName,
          operation,
          collection
        }));
      }
    } catch (e) {
      console.error(e);
    }
  });
});





