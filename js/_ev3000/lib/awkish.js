
(function() {
  d.std.rawList = {};

  d.std.rawList.preProcess = function(chunks, numDataStreams) {
    var startTime = new Date();
    var rawList = chunks.join('').split('\n');

    var resultName = 'dstream_r_' + numDataStreams;
    var first = rawList[0], m;
    if ((m = /^\s*:::([a-z_][a-z0-9_]*):::/i.exec(first))) {
      resultName = m[1];
      rawList.shift();
      first = null;
    }

    if (rawList[rawList.length - 1].length === 0) {
      rawList.pop();
    }

    var options = {
      resultName  : resultName, 
      first       : first,
      startTime   : startTime
    };

    return d.std.rawList.process(rawList, options, function(err, list, options) {
      return d.std.rawList.populate(list, options, function(err) {
        //return next();
      });
    });
  };

  // The default is AWK inspired

  // Create a bunch of per-field string tables
  d.std.strings  = d.std.strings || _.map(_.range(21), function(i) {
    return {};
  });

  var maxField = d.std.strings.length - 1;
  d.std.rawList.process = function(rawList, options, callback) {
    var list = _.map(rawList, function(record) {
      //return record.split(/[ \t]+/);

      var fields = _.map(record.split(/[ \t]+/), function(field, index) {
        if (/^[0-9]+/.exec(field)) { return parseInt(field, 10); }
        if (index > maxField) { index = maxField;}

        d.std.strings[index][field] = (d.std.strings[index][field] || field);
        return d.std.strings[index][field];
      });

      return fields;
    });

    return callback(null, list, options);
  };

  d.std.rawList.populate = function(list, options, callback) {
    var slot = d.list.length;
    d.list[slot] = list;
    return d.std.publishResult({response: list.length}, options, callback);
  };

  // ---------- Create the data listener---------- 
  var dataPort = net.createServer();
  var numDataStreams = 0;
  dataPort.on('connection', function(connection) {

    var chunks = [];
    connection.on('data', function(chunk) {
      chunks.push(chunk.toString());
    });

    connection.on('end', function() {
      numDataStreams++;
      d.std.rawList.preProcess(chunks, numDataStreams);
    });

  });

  console.log('Listening for data on ' + (d.std.port+2));
  dataPort.listen(d.std.port+2);
  //dataPort.listen('/tmp/ev3000_data');

  return 'awkish processor';
}());

