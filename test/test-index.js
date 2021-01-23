/* eslint-env mocha */
'use strict'
const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

const SLRU = require('../index')

describe('SLRU', function () {
  it('should insert new items to probationary section', function () {
    const cache = new SLRU({ protectedOptions: 10, probationaryOptions: 10 })

    // Insert 10 items --> Should all fit and stay in probationary section
    for (let i = 0; i < 10; ++i) {
      cache.set(i + '', i + '')
    }

    for (let i = 0; i < 10; ++i) {
      expect(cache.peek(i + '')).to.deep.equal(i + '')
      expect(cache.probationaryLru.peek(i + '')).to.deep.equal(i + '')
    }
  })

  it('should evict items from probationary section', function () {
    const cache = new SLRU({ protectedOptions: 10, probationaryOptions: 2 })

    cache.set('0', '0')
    cache.set('1', '1')
    cache.set('2', '2')

    expect(cache.peek('0')).to.deep.equal(undefined)
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)

    expect(cache.peek('1')).to.deep.equal('1')
    expect(cache.probationaryLru.peek('1')).to.deep.equal('1')

    expect(cache.peek('2')).to.deep.equal('2')
    expect(cache.probationaryLru.peek('2')).to.deep.equal('2')
  })

  it('should promote items to protected section', function () {
    const cache = new SLRU({ protectedOptions: 5, probationaryOptions: 5 })
    cache.set('0', '0')
    expect(cache.get('0')).to.deep.equal('0')
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('0')).to.deep.equal('0')

    expect(cache.get('0')).to.deep.equal('0')
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('0')).to.deep.equal('0')
  })

  it('should evict items from protected section to probationary section', function () {
    const cache = new SLRU({ protectedOptions: 2, probationaryOptions: 2 })

    cache.set('0', '0')
    expect(cache.get('0')).to.deep.equal('0')
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('0')).to.deep.equal('0')

    cache.set('1', '1')
    expect(cache.get('1')).to.deep.equal('1')
    expect(cache.probationaryLru.peek('1')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('1')).to.deep.equal('1')

    cache.set('2', '2')
    expect(cache.get('2')).to.deep.equal('2')
    expect(cache.probationaryLru.peek('2')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('2')).to.deep.equal('2')

    // Item 0 pushed out from protected section
    expect(cache.peek('0')).to.deep.equal('0')
    expect(cache.probationaryLru.peek('0')).to.deep.equal('0')
    expect(cache.protectedLru.peek('0')).to.deep.equal(undefined)

    // Access 0 again to check it goes back to protected section
    expect(cache.get('0')).to.deep.equal('0')
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('0')).to.deep.equal('0')

    // ... and item 1 was evicted to probationary section
    expect(cache.peek('1')).to.deep.equal('1')
    expect(cache.probationaryLru.peek('1')).to.deep.equal('1')
    expect(cache.protectedLru.peek('1')).to.deep.equal(undefined)
  })

  it('should promote entries to protected section if they are updated', function () {
    const cache = new SLRU({ protectedOptions: 2, probationaryOptions: 2 })

    cache.set('0', '0')
    expect(cache.peek('0')).to.deep.equal('0')
    expect(cache.probationaryLru.peek('0')).to.deep.equal('0')
    expect(cache.protectedLru.peek('0')).to.deep.equal(undefined)

    cache.set('0', '00')
    expect(cache.peek('0')).to.deep.equal('00')
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('0')).to.deep.equal('00')
  })

  it('should update entries in protected section if they are updated', function () {
    const cache = new SLRU({ protectedOptions: 2, probationaryOptions: 2 })

    cache.set('0', '0')
    expect(cache.get('0')).to.deep.equal('0')
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('0')).to.deep.equal('0')

    cache.set('0', '00')
    expect(cache.peek('0')).to.deep.equal('00')
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('0')).to.deep.equal('00')
  })

  it('should delete entries permanently', function () {
    const cache = new SLRU({ protectedOptions: 2, probationaryOptions: 2 })

    cache.set('0', '0')
    cache.get('0')
    cache.set('1', '1')

    cache.del('0')
    expect(cache.peek('0')).to.deep.equal(undefined)
    expect(cache.probationaryLru.peek('0')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('0')).to.deep.equal(undefined)

    cache.del('1')
    expect(cache.peek('1')).to.deep.equal(undefined)
    expect(cache.probationaryLru.peek('1')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('1')).to.deep.equal(undefined)
  })

  it('should handle falsy values', function () {
    const cache = new SLRU({ protectedOptions: 2, probationaryOptions: 2 })

    expect(cache.get('foo')).to.deep.equal(undefined)
    cache.set('foo', 0)
    expect(cache.peek('foo')).to.deep.equal(0)
    expect(cache.has('foo')).to.deep.equal(true)
    expect(cache.get('foo')).to.deep.equal(0)
    expect(cache.peek('foo')).to.deep.equal(0)
    expect(cache.has('foo')).to.deep.equal(true)
  })

  it('should handle different lack of options', function () {
    const cache = new SLRU()

    cache.set('foo', '0')
    expect(cache.peek('foo')).to.deep.equal('0')
    expect(cache.has('foo')).to.deep.equal(true)
    expect(cache.get('foo')).to.deep.equal('0')
    expect(cache.peek('foo')).to.deep.equal('0')
    expect(cache.has('foo')).to.deep.equal(true)
  })

  it('should pass options to lru-cache', function () {
    const cache = new SLRU({
      protectedOptions: {
        max: 2, length: () => 2
      },
      probationaryOptions: 2
    })

    cache.set('0', '0')
    expect(cache.get('0')).to.deep.equal('0')
    expect(cache.get('0')).to.deep.equal('0')

    cache.set('1', '1')
    expect(cache.get('1')).to.deep.equal('1')

    // 0 pushed out of protected section
    expect(cache.peek('0')).to.deep.equal('0')
    expect(cache.probationaryLru.peek('0')).to.deep.equal('0')
    expect(cache.protectedLru.peek('0')).to.deep.equal(undefined)

    expect(cache.peek('1')).to.deep.equal('1')
    expect(cache.probationaryLru.peek('1')).to.deep.equal(undefined)
    expect(cache.protectedLru.peek('1')).to.deep.equal('1')
  })

  function setupCache () {
    const cache = new SLRU({ protectedOptions: 2, probationaryOptions: 2 })

    cache.set('0', '0')
    cache.get('0')
    cache.set('1', '1')
    cache.get('1')

    cache.set('2', '2')
    cache.set('3', '3')
    return cache
  }

  it('should have working reset', function () {
    const cache = setupCache()
    cache.reset()

    expect(cache.has('0')).to.deep.equal(false)
    expect(cache.has('1')).to.deep.equal(false)
    expect(cache.has('2')).to.deep.equal(false)
    expect(cache.has('3')).to.deep.equal(false)
  })

  it('should have a working forEach', function () {
    const cache = setupCache()
    const items = []

    cache.forEach((key, value, cache) => {
      items.push({ key, value })
    })

    expect(items).to.deep.equal([
      { key: '1', value: '1' },
      { key: '0', value: '0' },
      { key: '3', value: '3' },
      { key: '2', value: '2' }
    ])
  })

  it('should have a working rforEach', function () {
    const cache = setupCache()
    const items = []

    cache.rforEach((key, value, cache) => {
      items.push({ key, value })
    })

    expect(items).to.deep.equal([
      { key: '0', value: '0' },
      { key: '1', value: '1' },
      { key: '2', value: '2' },
      { key: '3', value: '3' }
    ])
  })

  it('should have a working keys, values and length functions', function () {
    const cache = setupCache()
    cache.set('3', '3v')

    expect(cache.keys()).to.deep.equal(['3', '1', '0', '2'])
    expect(cache.values()).to.deep.equal(['3v', '1', '0', '2'])
    expect(cache.length).to.deep.equal(4)
    expect(cache.itemCount).to.deep.equal(4)
  })
})
