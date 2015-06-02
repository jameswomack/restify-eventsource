var Restify = require('restify');
var eventsource = require('../lib/sse');

var sse = eventsource({
  connections: 20
});

var broadcast = sse.sender('foo');

var server = Restify.createServer();

server.use(sse.middleware());

setInterval(function() {
  broadcast({ bar: 'baz' });
}, 2000);

server.listen(1337, function () {
  console.info('Restify is listening on port %s', server.port());
});
