
(function() {
  d.std.rawList = {};

  // Create a bunch of per-field string tables
  d.std.rawList.strings  = d.std.rawList.strings || _.map(_.range(21), function(i) {
    return {};
  });

  var maxField = d.std.rawList.strings.length - 1;

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
  d.std.rawList.process = function(rawList, options, callback) {
    var list = [];
    _.each(rawList, function(record__) {

      var record_ = record__.split(/[ \t]+/);
      var record = d.std.rawList.filterRecord(record_);
      if (record) {
        var fields = d.std.rawList.processRecord(record, record_);
        list.push(d.std.rawList.filterFields(fields));
      }
    });

    return callback(null, list, options);
  };

  d.std.rawList.processRecord = function(record, record_) {
    var fields = _.map(record, function(field_, index) {
      if (field_ !== null) { return field_; }
      var field = record_[index];

      if (/^[0-9]+/.exec(field)) { return parseInt(field, 10); }
      if (index > maxField) { index = maxField;}

      field = d.std.rawList.strings[index][field] = (d.std.rawList.strings[index][field] || field);
      return field;
    });

    return fields;
  };

  var empty = [];
  d.std.rawList.filterRecord = function(record) {
    var len = record.length;
    var ret = empty[len] = empty[len] || _.map(record, function() { return null; });
    return ret;
  };

  d.std.rawList.filterFields = function(fields) {
    return fields;
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

