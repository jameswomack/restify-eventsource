const Assert = require('assert-plus')
const RestifyEventSource = require('./')

describe('Restify EventSource', () => {

  it('exports a function', function () {
    Assert.func(RestifyEventSource)
  })

  describe('Restify EventSource instance', () => {
    const restifyEventSource = RestifyEventSource()

    it('has middleware', function () {
      Assert.func(restifyEventSource.middleware)
    })

    it('can retry', function () {
      Assert.func(restifyEventSource.retry)
    })
  })

})
