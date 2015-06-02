/* global EventSource */

(function js() {

  function es(channelName) {
    var eventSource = new EventSource('/' + channelName),
        pre = document.createElement('pre'),
        closed = false,
        parentEl = document.querySelector('#' + channelName)

    parentEl.appendChild(pre)

    eventSource.onmessage = function(ev) {
      if(closed) return

      var data = JSON.parse(ev.data);

      pre.appendChild(document.createTextNode(data.channelName.slice(0,2) + ' ' + data.time + '\n\n'))

      window.scrollTo(0, pre.clientHeight)
    }

    eventSource.addEventListener('end', function() {
      eventSource.close()
      closed = true
    }, true)

    eventSource.onerror = function(/* e */) {
      closed = true
    }
  }

  es('foo')
  es('bar')

})()
