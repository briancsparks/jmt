
(function() {
  console.log(d.std.port, 'Awkish starting');

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
  d.std.awkish.recordThreshold = d.std.awkish.recordThreshold || 30000; 

  // If we have no downstream ports, this gets called.  The 'real' one
  // is below.
  var sendToPorts = function(callback) {
    return callback();
  };

  var leftPort, rightPort, leftAwkish, rightAwkish;
  var haveDownstreamListeners = (d.std.node <= 30);      // 2, 6, 14, 30, 62, 126, 254

  if (haveDownstreamListeners) {
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
        console.error(d.std.port + ' left exit with ' + exitCode);
      }
    });

    rightAwkish.on('end', function(exitCode) {
      console.error(d.std.port + ' right exit with ' + exitCode);
    });

    setTimeout(function() {
      fs.readFile(path.join(__dirname, '_ev3000/lib/awkish.js'), function(err, contents) {
        sendToPort(d.std.awkish.leftPort, contents);
        sendToPort(d.std.awkish.rightPort, contents);
      });
    }, 1000);

    sendToPorts = function(callback) {
      return callback();
    };

  }

  var logfer1 = function() {
    //if (d.std.port === 10000 || d.std.port === 10001 || d.std.port === 10003 || d.std.port === 10007) {
    //  console.log.apply(this, arguments);
    //}
  };

  var oldEnqueueScript = d.std.enqueueScript;
  d.std.enqueueScript = function(chunks, connection) {
    var selfResult, leftResult, rightResult;
    var script = chunks.join('');

    logfer1(d.std.port, '----- Entering enqueueScript ' + script.length);

    // Hijack the connection's write and end function
    var oldEnd = connection.end;
    connection.end = function() {
      connection.write = oldWrite;
      connection.end   = oldEnd;

      selfResult = JSON.parse(selfResult.join('')) || arguments[0] || '';
      logfer1(d.std.port, '----- on end ' + JSON.stringify(selfResult));
      return finish();
    }

    var oldWrite = connection.write;
    connection.write = function(chunk) {
      selfResult = selfResult || [];
      selfResult.push(chunk.toString());
    };

    if (haveDownstreamListeners) {
      logfer1(d.std.port, '----- Sending downstream ' + script.length);
      sendToPort(d.std.awkish.leftPort, script, function(err, result) {
        leftResult = result;
        logfer1(d.std.port, '----- on lend ' + JSON.stringify(leftResult));
        return finish();
      });

      sendToPort(d.std.awkish.rightPort, script, function(err, result) {
        rightResult = result;
        logfer1(d.std.port, '----- on rend ' + JSON.stringify(rightResult));
        return finish();
      });
    } else {
      leftResult = rightResult = null;
    }

    var finish = function() {
      logfer1(d.std.port, '----- on finish ', selfResult && selfResult.length, leftResult && leftResult.length, rightResult && rightResult.length);
      if (selfResult && leftResult !== undefined && rightResult !== undefined) {
        // We have all the data!
        var reply = {};
        reply[d.std.node] = selfResult;

        if (leftResult)   { _.extend(reply, leftResult); }
        if (rightResult)  { _.extend(reply, rightResult); }

        reply = JSON.stringify(reply);
        logfer1(d.std.port, '----- reply ', reply);
        return oldEnd.call(connection, reply, 'utf8');
      }
    };

    return oldEnqueueScript(chunks, connection);
  };

  var sendToPort = function(port, str, callback) {
    console.log(d.std.port, 'awkish: sending ' + str.length + ' to ' + port);
    var socat = spawn('socat', ['-', 'tcp:localhost:'+port]);

    var chunks = [];
    socat.stdout.on('data', function(chunk) {
      chunks.push(chunk);
    });

    socat.on('close', function(exitCode) {
      if (callback) {
        return callback(exitCode !== 0, JSON.parse(chunks.join('')));
      }
    });

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

  d.std.rawList.preProcess = function(chunks, numDataStreams, options_, callback) {
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
        return callback();
      });
    });
  };

  // The default is AWK inspired
  d.std.rawList.process = function(rawList, options, callback) {
    var list = [], leftData = [], rightData = [];
    _.each(rawList, function(record__) {
      var sendToChild = false;

      if (!haveDownstreamListeners) {
        sendToChild = false;
      } else if (d.std.awkish.count >= 8 * d.std.awkish.recordThreshold) {
        // We always send to children
        if (d.std.awkish.leftCount + d.std.awkish.rightCount < (2*d.std.awkish.recordThreshold)+20) {
          console.log('2--'+d.std.node, d.std.awkish.count, d.std.awkish.leftCount, d.std.awkish.rightCount);
        }
        sendToChild = true;
      //} else if (d.std.awkish.count >= 1 * d.std.awkish.recordThreshold) {
      //  if (d.std.awkish.count < d.std.awkish.recordThreshold+10) {
      //    console.log('1--'+d.std.node, d.std.awkish.count, d.std.awkish.leftCount, d.std.awkish.rightCount);
      //  }
      //  if (d.std.awkish.count - d.std.awkish.recordThreshold > d.std.awkish.rightCount) {
      //    sendToChild = true;
      //  }
      } else {
        if (d.std.awkish.count > d.std.awkish.rightCount) {
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

    if (list.length > 0) {
      console.log(d.std.port, 'Sending data: self, left, right: ', list.length, leftData.length, rightData.length);
    }
    //try {
      if (leftData.length > 0) {
        options.left.stdin.write(leftData.join('\n'));
      }

      if (rightData.length > 0) {
        options.right.stdin.write(rightData.join('\n'));
      }
    //} catch(err) {
    //  console.log(d.std.port, 'Error trying to write to children', err);
    //}


    //if (leftData.length > 0) {
    //  var left  = spawn('socat', ['-', 'tcp:localhost:'+ (leftPort + 2000)]);
    //  left.stdin.setEncoding('utf8');
    //  left.stdin.write(leftData.join('\n'));
    //  left.stdin.end();
    //}

    //if (rightData.length > 0) {
    //  var right = spawn('socat', ['-', 'tcp:localhost:'+ (rightPort + 2000)]);
    //  right.stdin.setEncoding('utf8');
    //  right.stdin.write(rightData.join('\n'));
    //  right.stdin.end();
    //}

    return callback(null, list, options);
  };

  var empty = [];
  d.std.rawList.filterRecord = function(record) {
    var len = record.length;
    var ret = empty[len] = empty[len] || _.map(record, function() { return null; });
    return ret;
  };

  d.std.rawList.processRecord = function(record, record_) {
    var fields = _.map(record, function(field_, index) {
      if (field_ !== null) { return field_; }
      var field = record_[index];

      if (/^[0-9]+$/.exec(field)) { return parseInt(field, 10); }
      if (index > maxField) { index = maxField;}

      field = d.std.rawList.strings[index][field] = (d.std.rawList.strings[index][field] || field);
      return field;
    });

    return fields;
  };

  d.std.rawList.filterFields = function(fields) {
    return fields;
  };

  d.std.rawList.populate = function(list, options, callback) {
    var slot = d.list.length;
    d.list[slot] = list;
    return d.std.publishResult({finalResult: list.length}, options, callback);
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
  var left, right;
  var dataPort = net.createServer();
  var numDataStreams = 0;
  dataPort.on('connection', function(connection) {
    numDataStreams++;
    var dataStreamNum = numDataStreams;
    //console.log(d.std.port, 'New connection: ' + dataStreamNum);

    left  = left ||  spawn('socat', ['-', 'tcp:localhost:'+ (leftPort + 2000)]);
    right = right || spawn('socat', ['-', 'tcp:localhost:'+ (rightPort + 2000)]);

    left.stdin.setEncoding('utf8');
    right.stdin.setEncoding('utf8');

    var flushedTime, doneDisplayed = false;
    var pausedReason = null;
    var pauseInput = function(reason) {
      //console.log(d.std.port, dataStreamNum, 'Pausing ' + reason);
      pausedReason = reason;
      connection.pause();
    };

    var isPaused = function() {
      return pausedReason;
    };

    var resumeInput = function() {
      //console.log(d.std.port, dataStreamNum, 'Resuming ' + pausedReason);
      pausedReason = null;
      connection.resume();
    };

    var lines = [], numLines = 0;
    var chunks = [];
    //var dispatchLines = function() {
    //  if (isPaused() === 'TOO_MUCH_INPUT' && lines.length < 2000) {
    //    console.log(dataStreamNum, d.std.port, 'Resuming at ' + lines.length);
    //    resumeInput();
    //  }

    //  if (lines.length > 0) {
    //    var line = lines.shift();
    //    return dispatchLine(line, numLines, lines.length, function() {
    //      // Every so often, break out of the stack
    //      if (numLines % 10 === 0) { return setImmediate(dispatchLines); }

    //      return dispatchLines();
    //    });
    //  }
    //};

    //var dispatchLine = function(line, lineNum, numLinesRemaining, callback) {
    //  var c2;

    //  chunks.push(line + '\n');
    //  if (chunks.length >= 10000 || numLinesRemaining === 0) {
    //    c2 = chunks;
    //    chunks = [];
    //    console.log(dataStreamNum, d.std.port, numLinesRemaining, 'Sending: ' + c2.length);
    //    flushedTime = new Date();
    //    d.std.rawList.preProcess(c2, 9999, {left: left, right: right});
    //  }

    //  return callback();
    //};

    var remainder = '';
    connection.on('data', function(chunk) {
      var numLinesOnEnter = lines.length;
      doneDisplayed = false;

      lines = lines.concat((remainder + chunk.toString()).split('\n'));
      remainder = lines.pop();

      if (lines.length > 20000) {
        console.log(d.std.port, dataStreamNum, 'Pausing at ' + lines.length);
        pauseInput('TOO_MUCH_INPUT');
      }

      if (lines.length >= 10000) {
        pauseInput('NORMAL_PAUSE_TO_PROCESS');
        var chunky = _.map(lines, function(line) { return line+ '\n'; });
        lines = [];
        flushedTime = new Date();
        d.std.rawList.preProcess(chunky, 9999, {left: left, right: right}, function(err) {
          setTimeout(function() {
            resumeInput();
          }, 100);
        });
      }
    });

    var closed = false;
    connection.on('end', function() {
      var chunky = _.map(lines, function(line) { return line+ '\n'; });
      lines = [];
      flushedTime = new Date();
      d.std.rawList.preProcess(chunky, 9999, {left: left, right: right}, function(err) {
        //console.log(d.std.port, 'Closing children ' + dataStreamNum);
        closed = true;
        //left.stdin.end();
        //right.stdin.end();
      });
    });

    var watchdog = function() {
      var now = new Date();
      if (now - flushedTime > (5000 + (d.std.node * 10))) {
        if (lines.length > 0) {
          console.log(d.std.port, 'Watchdog flushing ' + lines.length + (haveDownstreamListeners ? '' :  '----------------'));
          var chunky = _.map(lines, function(line) { return line+ '\n'; });
          lines = [];
          flushedTime = new Date();
          d.std.rawList.preProcess(chunky, 9999, {left: left, right: right}, function(err) {
          });
        } else {
          if (!doneDisplayed) {
            doneDisplayed = true;
            //console.log(d.std.port, 'Watchdog done? ' + (now - flushedTime));
          }
        }
      }
      setTimeout(watchdog, 100);
    };
    watchdog();

    var dumpDebug = function() {
      if (lines.length > 9999) {
        console.log(d.std.port, dataStreamNum, lines.length);
      }
      if (!closed) {
        setTimeout(dumpDebug, 1000);
      }
    };
    dumpDebug();

  });

  d.std.dataPort = 12000 + d.std.node;
  console.log('Listening for data on ' + (d.std.dataPort));
  dataPort.listen(d.std.dataPort);
  //dataPort.listen('/tmp/ev3000_data');

  return 'awkish processor';
}());

