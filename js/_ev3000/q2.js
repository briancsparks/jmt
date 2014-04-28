
(function() {

  var buckets = {};
  _.each(d.r_, function(list, key) {
    _.each(list, function(item) {
      var name = item.bucket;
      buckets[name] = (buckets[name] || 0) + item.count;
    });
  });

  return _.chain(buckets).
    map(function(v,k) {
      return {bucket:k, count:v};
    }).
    sortBy(function(x) {
      return -x.count;
    }).value();

}());

