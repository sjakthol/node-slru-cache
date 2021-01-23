# slru-cache - Segmented Least Recently Used Cache

Segmented Least Recently Used Cache for Node.js.

![Build Workflow](https://github.com/sjakthol/node-slru-cache/workflows/.github/workflows/nodejs_ci.yaml/badge.svg)

## Installation

```
npm install slru-cache
```

## Usage

```javascript
const SLRU = require('slru-cache')
const cache = new SLRU({ protectedOptions: 100, probationaryOptions: 100 })

// Add item
cache.set('hello', { msg: 'Hello world' })

// Check existence of item (does not update last access)
cache.has('hello') // --> true
cache.has('goodbye') // --> false

// Get item (updates last access)
cache.get('hello') // --> { msg: 'Hello world' }
cache.get('goodbye') // --> undefined

// Get item without updating last access
cache.peek('hello') // --> { msg: 'Hello world' }
cache.peek('goodbye') // --> undefined

// Delete item for good
cache.del('hello')
cache.has('hello') // --> false
```

`slru-cache` interface is compatible with [lru-cache](https://github.com/isaacs/node-lru-cache)
with the following exceptions:

* Constructor expects options for two `lru-cache` objects (one for probational
  and another for protected segment). Most options are supported except for
  * `maxAge` (expiry after time)
  * `dispose` (callback to call when an object is evicted from the cache)
  * `noDisposeOnSet` (option to disable calling dispose callback when item is updated)

* Most methods are supported and work as those of `lru-cache`. Exceptions to that are
  * `maxAge` argument to `set()` is not supported
  * `forEach()`, `rforEach()`, `keys()`, `values()` iterate items segment by segment
    (protected first, probational second) instead in most/least recently used order
  * `prune()` is not supported

See [lru-cache](https://github.com/isaacs/node-lru-cache) for additional information
on available methods.

## SLRU Cache

[Segmented Least Recently Used (SLRU)](https://en.wikipedia.org/wiki/Cache_replacement_policies#Segmented_LRU_(SLRU))
cache is an LRU-like cache with two segments:

* a probational segment which is an LRU cache that keeps items that have
  been accessed once

* a protected segment which is an LRU cache that keeps items that have
  been accessed more than once

An SLRU cache is effective in cases where keys that are accessed more than
once are much more likely to be accessed again than keys that have not
been accessed since insertion.

An SLRU cache item has the following lifecycle:

* New item is inserted to probational segment. This item becomes the most
  recently used item in the probational segment.

  * If the probational segment is full, the least recently used item is
    evicted from cache.

* If an item in the probational segment is accessed (with get or set), the
  item is migrate to the protected segment. This item becomes the most
  recently used item of the protected segment.

  * If the protected segment is full, the least recently used item from
    the segment is moved to probational segment. This item becomes the
    most recently used item in the probational segment.

* If an item in the protected segment is accessed, it becomes the most
  recently used item of the protected segment.

## Credits & References

* [The Cache Replacement Problem](http://alexandrutopliceanu.ro/post/cache-replacement-problem/) by Alexandru Topliceanu
* [lru-cache](https://github.com/isaacs/node-lru-cache) by isaacs
* [velo](https://github.com/velo-org/velo) by Julian Kaindl and Matthias Herzog

## License

MIT.
