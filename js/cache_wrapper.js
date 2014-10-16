function cacheWrapper(func) {
  var cs = new CacheService('cacheWrapper');
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var key = func.name + '(' + args.join(', ') + ')';
    var cache = cs.get(key);
    if (cache) return cache;
    var result = func.apply(func, arguments);
    cs.set(key, result);
    return result;
  }
}
