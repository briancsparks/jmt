
(function() {

  var spawn           = require('child_process').spawn;
  var fs              = require('fs');
  var path            = require('path');

  // Make sure we are configured right
  d.std.node = d.std.port - 10000;
  if (d.std.node < 0 || d.std.node > 1000) {
    console.error('Error -- must start with a 10000-ish port');
    return;
  }

  d.std.awkish = d.std.awkish || {};
  d.std.awkish.count = 0;
  d.std.awkish.leftCount = 0;
  d.std.awkish.rightCount = 0;
  d.std.awkish.recordThreshold = d.std.awkish.recordThreshold || 100000; 

  var leftPort, rightPort, leftAwkish, rightAwkish;
  if (d.std.node <= 6) {
    leftPort  = d.std.awkish.leftPort   = 10000 + (d.std.node*2) + 1;
    rightPort = d.std.awkish.rightPort  = 10000 + (d.std.node*2) + 2;
    console.log('Spawning left and right', leftPort, rightPort);

    leftAwkish  = d.std.awkish.left  = spawn('jmt', ['ev3000', '--port=' + leftPort]);
    rightAwkish = d.std.awkish.right = spawn('jmt', ['ev3000', '--port=' + rightPort]);

    leftAwkish.stdout.on('data', function(chunk) {
      process.stdout.write(chunk.toString());
    });

    rightAwkish.stdout.on('data', function(chunk) {
      process.stdout.write(chunk.toString());
    });

    leftAwkish.stderr.on('data', function(chunk) {
      process.stderr.write(chunk.toString());
    });

    rightAwkish.stderr.on('data', function(chunk) {
      process.stderr.write(chunk.toString());
    });

    leftAwkish.on('end', function(exitCode) {
      if (exitCode !== 0) {
        console.error(d.std.node + ' left exit with ' + exitCode);
      }
    });

    rightAwkish.on('end', function(exitCode) {
      console.error(d.std.node + ' right exit with ' + exitCode);
    });

    var oldEnqueueScript = d.std.enqueueScript;
    d.std.enqueueScript = function(chunks) {
      var script = chunks.join('');
      sendToPort(d.std.awkish.leftPort, script);
      sendToPort(d.std.awkish.rightPort, script);
      return oldEnqueueScript(chunks);
    };

    setTimeout(function() {
      fs.readFile(path.join(__dirname, '_ev3000/lib/awkish.js'), function(err, contents) {
        sendToPort(d.std.awkish.leftPort, contents);
        sendToPort(d.std.awkish.rightPort, contents);
      });
    }, 1000);

  }

  var sendToPort = function(port, str) {
    console.log('awkish: sending ' + str.length + ' to ' + port);
    var socat = spawn('socat', ['-', 'tcp:localhost:'+port]);
    socat.stdin.setEncoding('utf8');
    socat.stdin.write(str);
    socat.stdin.end();
  };

  d.std.rawList = {};

  // Create a bunch of per-field string tables
  d.std.rawList.strings  = d.std.rawList.strings || _.map(_.range(21), function(i) {
    return {};
  });

  var maxField = d.std.rawList.strings.length - 1;

  d.std.rawList.preProcess = function(chunks, numDataStreams, options_) {
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
      startTime   : startTime,
      left        : options_.left,
      right       : options_.right
    };

    return d.std.rawList.process(rawList, options, function(err, list, options) {
      return d.std.rawList.populate(list, options, function(err) {

        //return next();
      });
    });
  };

  // The default is AWK inspired
  d.std.rawList.process = function(rawList, options, callback) {
    var list = [], leftData = [], rightData = [];
    _.each(rawList, function(record__) {
      var sendToChild = false;

      if (d.std.awkish.count >= 8 * d.std.awkish.recordThreshold) {
        // We always send to children
        if (d.std.awkish.leftCount + d.std.awkish.rightCount < (2*d.std.awkish.recordThreshold)+200) {
          console.log('2--'+d.std.node, d.std.awkish.count, d.std.awkish.leftCount, d.std.awkish.rightCount);
        }
        sendToChild = true;
      } else if (d.std.awkish.count >= 1 * d.std.awkish.recordThreshold) {
        if (d.std.awkish.count < d.std.awkish.recordThreshold+100) {
          console.log('1--'+d.std.node, d.std.awkish.count, d.std.awkish.leftCount, d.std.awkish.rightCount);
        }
        if (d.std.awkish.count - d.std.awkish.recordThreshold > d.std.awkish.rightCount) {
          sendToChild = true;
        }
      }

      if (sendToChild) {
        if (d.std.awkish.rightCount < d.std.awkish.leftCount) {
          rightData.push(record__);
          //options.right.stdin.write(record__);
          d.std.awkish.rightCount++;
        } else {
          leftData.push(record__);
          //options.left.stdin.write(record__);
          d.std.awkish.leftCount++;
        }
      } else {
        var record_ = record__.split(/[ \t]+/);
        var record = d.std.rawList.filterRecord(record_);
        if (record) {
          var fields = d.std.rawList.processRecord(record, record_);
          list.push(d.std.rawList.filterFields(fields));
          d.std.awkish.count++;
        }
      }
    });


    if (leftData.length > 0) {
      var left  = spawn('socat', ['-', 'tcp:localhost:'+ (leftPort + 2000)]);
      left.stdin.setEncoding('utf8');
      left.stdin.write(leftData.join('\n'));
      left.stdin.end();
    }

    if (rightData.length > 0) {
      var right = spawn('socat', ['-', 'tcp:localhost:'+ (rightPort + 2000)]);
      right.stdin.setEncoding('utf8');
      right.stdin.write(rightData.join('\n'));
      right.stdin.end();
    }

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

  d.std.skwish = function(x, dictNum) {
    var i, l, keys, key, value, numAdded = 0;
    var ret;

    if (_.isObject(x) && !_.isArray(x)) {
      ret = {};
      keys = _.keys(x);
      for (i = 0, l = keys.length; i < l; i++) {
        key = keys[i];
        value = x[key];

        if (value === null) { continue; }
        if (value === '')   { continue; }

        if (_.isString(value)) {
          ret[key] = d.std.rawList.strings[dictNum][value] = d.std.rawList.strings[dictNum][value] || value; 
          numAdded++;
          continue;
        }

        if (/^[0-9]+$/.exec(value)) {
          ret[key] = parseInt(value, 10);
        }

        ret[key] = d.std.skwish(x[key], dictNum);
        numAdded++;
      }
      return ret;
    }

    return x;
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
      d.std.rawList.preProcess(chunks, numDataStreams, {});
    });

  });

  d.std.dataPort = 12000 + d.std.node;
  console.log('Listening for data on ' + (d.std.dataPort));
  dataPort.listen(d.std.dataPort);
  //dataPort.listen('/tmp/ev3000_data');

  return 'awkish processor';
}());

