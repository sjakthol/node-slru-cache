const LRU = require('lru-cache')

/**
 * Segmented Least Recently Used (SLRU) cache is a cache with two segments:
 *
 * * probational segment which is an LRU cache that keeps items that have
 *   been accessed once
 *
 * * protected segment which is an LRU cache that keeps items that have
 *   been accessed more than once
 *
 * SLRU cache is effective in cases where keys that are accessed more than
 * once are much more likely to be accessed again than keys that have not
 * been accessed since insertion.
 *
 * An SLRU cache item has the following lifecycle:
 *
 * * New item is inserted to probational segment. This item becomes the most
 *   recently used item in the probational segment.
 *
 *   * If the probational segment is full, the least recently used item is
 *     evicted from cache.
 *
 * * If an item in the probational segment is accessed (with get or set), the
 *   item is migrate to the protected segment. This item becomes the most
 *   recently used item of the protected segment.
 *
 *   * If the protected segment is full, the least recently used item from
 *     the segment is moved to probational segment. This item becomes the
 *     most recently used item in the probational segment.
 *
 * * If an item in the protected segment is accessed, it becomes the most
 *   recently used item of the protected segment.
 */

class SLRU {
  /**
   * Create a new SLRU cache.
   *
   * A new SLRU cache is created as follows:
   *
   * ```
   * const SLRU = require('slru-cache')
   * const cache = new SLRU({ protectedOptions: 5, probationalOptions: 10 })
   * ```
   *
   * This configures SLRU cache to keep maximum of 5 items in the protected
   * and 10 items in the probational segment.
   *
   * SLRU cache supports same options as lru-cache for the two cache segments
   * except for `maxAge`, `dispose` and `noDisposeOnSet` options. These are
   * not supported.
   *
   * See [lru-cache](https://github.com/isaacs/node-lru-cache) documentation for
   * details on supported options.
   *
   * @param {object} [options] - Cache options.
   * @param {number|object} [options.protectedOptions] - Options for protected segment of the
   *  cache. Maximum number of items (number) or options object for lru-cache.
   * @param {number|object} [options.probationaryOptions] - Options for probationary segment of the
   *  cache. Maximum number of items (number) or options object for lru-cache.
   */
  constructor (options) {
    if (!options) {
      options = {}
    }

    // Probationary segment for the cache
    this.probationaryLru = new LRU(options.probationaryOptions)

    // Protected segment of the cache. Reformat options to support
    // a dispose function that moves evicted items from protected
    // to probationary segment
    if (typeof options.protectedOptions !== 'object') {
      options.protectedOptions = { max: options.protectedOptions }
    }

    // Custom dispose() hook to move items evicted from protected segment
    // back to probationary segment. noDisposeOnSet = true is needed to
    // avoid duplicates when an item in protected segment is updated
    options.protectedOptions.noDisposeOnSet = true
    options.protectedOptions.dispose = (k, v) => {
      this.probationaryLru.set(k, v)
    }

    // Protected segment for the cache
    this.protectedLru = new LRU(options.protectedOptions)
  }

  /**
   * Get item from cache. Updates last access and promotes existing
   * items to protected segment.
   *
   * @param {any} key key to fetch
   *
   * @returns {any} value of matching item or `undefined` if key is not in cache
   */
  get (key) {
    const protectedItem = this.protectedLru.get(key)
    const probationaryItem = this.probationaryLru.peek(key)

    if (protectedItem === undefined && probationaryItem === undefined) {
      // Item does not exist in either segment --> return undefined
      return undefined
    }

    if (protectedItem !== undefined) {
      // Item exists in protected segment --> return to caller
      return protectedItem
    }

    // Item is in probationary segment --> promote to protected
    this.probationaryLru.del(key)
    this.protectedLru.set(key, probationaryItem)

    return probationaryItem
  }

  /**
   * Get item without updating last access or promoting to protected
   * segment.
   *
   * @param {any} key key to check
   * @returns {any} value of matching item or `undefined` if key is not in cache
   */
  peek (key) {
    const protectedItem = this.protectedLru.peek(key)
    const probationaryItem = this.probationaryLru.peek(key)

    if (protectedItem === undefined) {
      return probationaryItem
    }

    return protectedItem
  }

  /**
   * Add or update item in the cache.
   *
   * * If key does not exist in cache, it's added to probational segment
   *   as the most recently used item.
   * * If key exists in probational segment, it's value is updated and
   *   promoted to protected segment as the most recently used item.
   * * If key exists in protected segment, it's value is updated and
   *   marked as most recently used item in that segment.
   *
   * @param {any} key key to set
   * @param {any} value value to set
   */
  set (key, value) {
    if (this.protectedLru.has(key)) {
      // Item in protected segment already --> update it.
      this.protectedLru.set(key, value)
    } else if (this.probationaryLru.has(key)) {
      // Item in probationary segment already --> promote + update it.
      this.probationaryLru.del(key)
      this.protectedLru.set(key, value)
    } else {
      // Item in cache --> insert it to probationary segment
      this.probationaryLru.set(key, value)
    }
  }

  /**
   * Delete key from cache.
   *
   * Affects both protected and probational segments.
   *
   * @param {any} key key to delete
   */
  del (key) {
    this.probationaryLru.del(key)
    this.protectedLru.del(key)

    // Need to delete item from probationary segment again since eviction
    // from protected segment would copy it back to probationary segment
    this.probationaryLru.del(key)
  }

  /**
   * Check if item exists in cache. Does not update last access
   * of existing item.
   *
   * @param {any} key key to check
   * @returns {boolean} true or false
   */
  has (key) {
    return this.protectedLru.has(key) || this.probationaryLru.has(key)
  }

  /**
   * Wipe away all items from cache (both segments).
   */
  reset () {
    this.protectedLru.reset()
    this.probationaryLru.reset()
  }

  /**
   * Iterates over all items in the cache in the following order:
   *
   * * items in protected segment, from most to least recently used
   * * items in probational segment, from most to least recently used
   *
   * @param {(this: any, value: any, key: any, cache: LRU) => void} callbackFn -
   *  function called with (key, value, cache) as arguments for each item in cache
   * @param {any} thisp - this value to callback function
   */
  forEach (callbackFn, thisp) {
    this.protectedLru.forEach(callbackFn, thisp)
    this.probationaryLru.forEach(callbackFn, thisp)
  }

  /**
   * Iterates over all items in the cache in the following order:
   *
   * * items in protected segment, from least to most recently used
   * * items in probational segment, from least to most recently used
   *
   * @param {(this: any, value: any, key: any, cache: LRU) => void} callbackFn -
   *  function called with (key, value, cache) as arguments for each item in cache
   * @param {any} thisp - this value to callback function
   */
  rforEach (callbackFn, thisp) {
    this.protectedLru.rforEach(callbackFn, thisp)
    this.probationaryLru.rforEach(callbackFn, thisp)
  }

  /**
   * Return an array of the keys in both segments of the cache (protected first,
   * probationary second)
   *
   * @returns {any[]}
   */
  keys () {
    return [...this.protectedLru.keys(), ...this.probationaryLru.keys()]
  }

  /**
   * Return an array of the keys in both segments of the cache (protected first,
   * probationary second)
   *
   * @returns {any[]}
   */
  values () {
    return [...this.protectedLru.values(), ...this.probationaryLru.values()]
  }

  /**
   * Return total length of objects in cache (both segments) taking into account
   * length options function.
   */
  get length () {
    return this.protectedLru.length + this.probationaryLru.length
  }

  /**
   * Return total quantity of objects currently in cache (both segments).
   */
  get itemCount () {
    return this.protectedLru.itemCount + this.probationaryLru.itemCount
  }
}

module.exports = SLRU
