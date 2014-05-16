
(function() {
  var moment = require('moment');

  var aggregated = [];
  // Merge
  _.each(d.r_, function(value, serverId) {
    if (_.isArray(value)) {
      aggregated = aggregated.concat(value);
    }
  });

  _.sortBy(aggregated, function(x) {
    return x[0];
  });

  _.each(aggregated, function(x, i) {
    var d = moment(x[0]);
    aggregated[i][0] = d.format("YYYY/MM/DD/HH/mm/ss");
  });

  return _.map(aggregated, function(x) {
    return x.join(' ');
  }).join('\n');

  //return aggregated;
}());

//// This aggregates a histogram
//(function() {
//  var out = {};
//  _.each(d.r_, function (v,k) {
//    _.each(v, function(x) {
//      out[x.bucket] = (out[x.bucket] || 0) + x.count;
//    });
//  });
//  return out;
//}());

