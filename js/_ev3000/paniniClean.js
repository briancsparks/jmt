
(function() {
  var urlLib          = require('url');
  var skwish          = d.std.skwish;

  var numProcessed = 0;
  //console.log(d.std.node, d.list.length);
  _.each(d.list, function(l, listNum) {
    //console.log(d.std.node, listNum, l.length);
    _.each(l, function(x, lineNum) {
      //console.log(d.std.node, listNum, lineNum, x.length);
      var url;
      if (typeof x[6] === 'string') {
        url = urlLib.parse(x[6], true);
      } else {
        url = x[6];
      }
      delete url.search;
      delete url.path;
      delete url.href;
      delete url.query.message;

      l[lineNum][6] = skwish(url, 6);

      if (typeof x[10] === 'string') {
        url = urlLib.parse(x[10], true);
      } else {
        url = x[10];
      }
      delete url.search;
      delete url.path;
      delete url.href;
      delete url.query.message;

      l[lineNum][10] = skwish(url, 10);

      numProcessed++;
    });
  });

  return 'Loaded Panini cleaner ' + numProcessed;
}());


