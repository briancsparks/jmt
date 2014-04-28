

(function() {
  var spawn           = require('child_process').spawn;
  var fs              = require('fs');
  var path            = require('path');

  console.log(d.std.port, 'Awkish0 starting');

  var downstreamPort = 10000;
  var downstream = spawn('jmt', ['ev3000', '--port=' + downstreamPort]);
  downstream.stdout.on('data', function(chunk) {
    process.stdout.write(chunk.toString());
  });

  downstream.stderr.on('data', function(chunk) {
    process.stderr.write(chunk.toString());
  });

  downstream.on('exit', function(exitCode) {
    //if (exitCode !== 0) {
      console.error(' downstream exit with ' + exitCode);
    //}
  });

  setTimeout(function() {
    return fs.readFile(path.join(__dirname, '_ev3000/lib/awkish.js'), function(err, contents) {
      return sendToPort(downstreamPort, contents);
    });
  }, 1000);

  d.std.execScript = function(script, callback) {
    var _stats = {userResult: null};

    _stats.startTime = new Date();
    _stats.numProcessed = 0;
    _stats.perf = {};

    var localCallback = function(err, userResult_) {
      var userResult = userResult_;
      if (userResult === undefined) {
        userResult = '*** No results provided ***';
      }
      _stats.finalResult = _stats.userResult = userResult;

      _stats.endTime = new Date();
      _stats.elapsed = _stats.endTime - _stats.startTime;

      return callback(err, _stats);
    };

    var awk = function(fn) {
      var script = ['(', fn.toString(), '());'].join('');
      var finalCallback = getCallback();
      return sendToPort(downstreamPort, script, function(err, result) {
        return finalCallback(err, result);
      });
    };

    var getCallbackWasCalled = false;
    var getCallback = function() {
      getCallbackWasCalled = true;
      return localCallback;
    };

    try {
      _stats.finalResult = _stats.userResult = eval(script);
    } catch(err) {
      _stats = _.extend(_stats, {error: err});
    }

    if (!getCallbackWasCalled) {
      return localCallback(_stats.error, _stats.userResult);
    }
  };

  var oldPublishResult = d.std.publishResult;
  d.std.publishResult = function(stats, options, callback) {
    options.resultName = options.resultName || 'r_' + (++numResults);
    d.r_ = stats.finalResult;
    return oldPublishResult.apply(this, arguments);
  };

  var sendToPort = function(port, str, callback) {
    console.log(d.std.port, 'awkish0: sending ' + str.length + ' to ' + port);
    var socat = spawn('socat', ['-T999.0', '-t999.0', '-', 'tcp:localhost:'+port]);

    var chunks = [];
    socat.stdout.on('data', function(chunk) {
      chunks.push(chunk);
    });

    socat.on('exit', function(exitCode) {
      if (callback) {
        var str = chunks.join(''), res;
        try {
          res = JSON.parse(str);
        } catch(err) {
          console.log(d.std.port, 'Error JSON parsing', str);
          res = '';
        }
        return callback(exitCode !== 0, res);
      }
    });

    socat.stdin.setEncoding('utf8');
    socat.stdin.write(str);
    socat.stdin.end();
  };


  return 'awkish0 processor';
}());

