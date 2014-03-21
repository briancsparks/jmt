
var sg        = require('../../utils/sg');

var printf    = sg.printf;

exports.filters = [
  
  // Categorize the IP [f3]
  function(emitter) {
    return function(item, slug) {
      emitter.SADD(printf("ip:%s1:slugs", item[3]), slug);
      emitter.SET(printf("slug:%s1:ip", slug), item[3]);
    };
  }
];

