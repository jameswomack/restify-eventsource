var Path        = require('path'),
    Restify     = require('restify'),
    eventsource = require('./lib/sse')

var sse    = eventsource(),
    server = Restify.createServer()

// Push to acceptable, need to inject middleware on top
server.acceptable.push('text/event-stream')
server.use(Restify.acceptParser(server.acceptable))
server.use(Restify.gzipResponse())
server.use(sse.middleware())

server.get(/^\/?.*/, Restify.serveStatic({
  directory: Path.join(process.cwd(), '/public'),
    default: 'index.html'
}))
server.on('uncaughtException', function (req, res, route, e) {
  console.error(e.stack);
});

function bc(channelName) {
  var broadcast = sse.sender(channelName),
      interval       = 1000
  // Send the time every `interval`
  setInterval(function() {
    broadcast({ time: Date.now() })
  }, interval)
}
['foo','bar'].forEach(bc)

server.listen(1337, function () {
  console.info('Restify is listening at %s', server.url)
})
