/**
 * Middleware for Restify
 * Server-Sent Events implementation.
 * http://www.w3.org/TR/eventsource/
 * BSD Licensed
 */

var events = require('events');


var HISTORY_SIZE = 500;
var PING_INTERVAL = 60000;


function sse(options) {

  options = options || {};
  var maxconn = options.connections  || Infinity;
  var maxsize = options.history      || HISTORY_SIZE;
  var pingint = options.pingInterval || PING_INTERVAL;


  var self    = Object.create(events.EventEmitter.prototype);
  var emitter = new events.EventEmitter();
  // Holds channels
  var history = {};
  var conns   = [];
  var uid     = -1;

  /**
   * Broadcasts a message to all clients.
   */
  function send(data, channelName) {
    if (typeof data === 'undefined') return;
    if (channelName && typeof channelName !== 'string') {
      throw new Error('channelName should be a string');
    }

    if (!channelName) channelName = 'message';

    var legacy      = false,
        data_header = legacy ? 'data:' : 'data: ',
        id = (++uid);

    var msg = (function () {
      data.channelName = channelName;
      var dataString = JSON.stringify(data);

      var response =
          'id: '+(id)+'\n\n' +
          (legacy ? 'Event: data\n' : '') +
          data_header +
          dataString.split('\n').join('\n'+data_header)+'\n\n'

      return response;
    })();

    history[channelName] = history[channelName] || [];
    var channel = history[channelName];
    if (channel.unshift(msg) > maxsize) {
      channel.pop();
    }

    var channelWriteEventName = 'write:' + channelName;
    emitter.emit(channelWriteEventName, msg);
    self.emit('send', channelName, data);
  }

  /**
   * Curried send function on a specific channel
   */
  function sender(channelName) {
    return function(data) {
      send(data, channelName);
    };
  }

  /**
   * Sends a retry command (parameter in seconds)
   */
  function retry(i) {
    i = Math.abs(parseInt(i, 10));
    if (i >= 0) {
      emitter.emit('retry', i);
    }
  }

  function middleware(req, res, next) {
    var last,
        interval,
        channelName = req.path().slice(1),
        channel;

    var shouldTreatAsEventStream = !!~req.headers.accept.indexOf('text/event-stream');
    if (shouldTreatAsEventStream) {
      res.handledGzip && res.handledGzip();
      res.removeHeader('Content-Encoding');
    }

    function flipToChannel() {
      var channelWasCreated = !!history[channelName];
      if (!channelWasCreated) {
        history[channelName] = [];
      }

      channel = history[channelName];
    }


    function addChannelsToReq() {
      // Only add to `req` if someone else has not
      var propname = '_eventSourceChannels';
      if (!req.hasOwnProperty(propname)) {
        req._eventSourceChannels = [];
      }
      // For convenience of logging, store channels on `req`
      if (Array.isArray(req._eventSourceChannels)) {
        req._eventSourceChannels.push(channelName);
      }
    }

    var channelWriteEventName = 'write:' + channelName;

    /**
     * Write message data in tcp stream.
     */
    function write(response) {
      return res.write(response)
    }


    /**
     * Clean ping and bound listeners.
     */
    function clean() {
      emitter.removeListener(channelWriteEventName, write);
      emitter.removeListener('retry', retry);
      clearInterval(interval);

      self.emit('close', req, res);
    }


    /**
     * Send missed messages
     */
    function missedEvents() {
      var i = Math.min(uid - last, channel.length);
      while (--i >= 0) {
        write(channel[i]);
      }
    }


    /**
     * Send a ping in the tcp stream.
     */
    function ping() {
      res.write(':\n');
    }


    /**
     * Send a retry command.
     */
    function retry(i) {
      res.write('retry:' + i);
    }
    if (shouldTreatAsEventStream) {
      flipToChannel();
      addChannelsToReq();

      // Turnover if the connection threshold is exceeded

      if (options.turnover && conns.push(res) > maxconn) {
        var conn = conns.shift();
        process.nextTick(function() { conn.end(); });
      }


      // Send missed messages if Last-Event-ID header is specified
      last = parseInt(req.header('Last-Event-ID'), 10);
      if (!isNaN(last)) {
        process.nextTick(missedEvents);
      }


      // Keep tcp connection open

      // Node.js 0.12 requires timeout argument be finite
      req.socket.setTimeout(0x7FFFFFFF);
      req.addListener('end',   function () {
        // Retry logic could go here
        console.info('closed by server');
        clean();
      });
      req.addListener('close', function () {
        console.info('closed by client');
        clean();
      });


      // Bind message listener on write
      emitter.addListener(channelWriteEventName, write);
      emitter.addListener('retry', retry);


      // Send a pings

      if (pingint > 0) {
        interval = setInterval(ping, Math.max(1000, pingint));
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.writeHead(200);
      res.write('\n\n');

      return self.emit('open', req, res);

    } else {
      return next();
    }
  }

  // Public api

  self.middleware = function() { return middleware; };
  self.sender = sender;
  self.send = send;
  self.retry = retry;

  return self;
}

module.exports = sse;
