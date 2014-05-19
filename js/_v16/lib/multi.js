/**
 *  @fileOverview: Control multiple other v16 instances.
 */

(function() {
  var callback = async();

  var numChildren = 64;

  var children, childScript = '';

  var main = function() {

    sg.__run([

      function(next) {
        init('multi', {children:[]});
        children = multi.children;

        multi.count = multi.count || numChildren;
        return next();
      },

      function(next) {
        return fs.readFile(path.join(__dirname, '_v16/lib/multiChild.js'), 'utf8', function(err, contents) {
          if (err) { return next(); }

          /* otherwise */
          childScript = contents;
          return next();
        });
      },

      function(next) {
        // ---------- Launch children ----------

        sg.__eachll(_.range(multi.count),
          function(i, nextChild) {
            var args = ['--expose-gc', path.join(__dirname, 'v16')];
            if (ARGV.no_catch) {
              args.push('--no_catch');
            }
            args.push('--port=' + (10000 + i));

            var proc = spawn('node', args);
            proc.stdin.setEncoding('utf8');
            
            proc.stdout.setEncoding('utf8');
            proc.stdout.on('data', function(chunk) {
              process.stdout.write('' + i + ': ' + chunk);
            });

            proc.stderr.setEncoding('utf8');
            proc.stderr.on('data', function(chunk) {
              process.stderr.write('e' + i + ': ' + chunk)
            });

            proc.on('exit', function(exitCode, signal) {
              console.log('Exit(' + i + '): ' + exitCode + ' sig: ' + signal);
              children[i] = null;
            });

            proc.on('close', function(exitCode, signal) {
              console.log('Close(' + i + '): ' + exitCode + ' sig: ' + signal);
              children[i] = null;
            });

            proc.on('error', function(err) {
              console.log('Error(' + i + '): ' + util.inspect(err));
              children[i] = null;
            });

            children[i] = {id: i, process: proc, port: 10000 + i};

            // The child is spawned.  Wait a few and send the child script
            setTimeout(function() {
              return sendScript(childScript, i, function(err) {
                if (err) { return nextChild(); }

                /* otherwise */
                return nextChild();
              });
            }, 50);
          },

          next
        );
      }],

      function done() {
        listenForMultiScripts();
        setTimeout(function() {
          return callback(null, 43);
        }, 200);
      }

    );    // sg.__run()

  };      // main()

  var sendScript = function(script, childNum, callback) {
    var numTries = 0;
    var sendScript_ = function() {
      numTries++;
      return __sys.sendData(script, {port: childNum + 10000}, function(err, resultStr) {
        if (err && err.code === 'ECONNREFUSED' && numTries < 20) { return setTimeout(sendScript_, 500); }
        if (err) { return callback.apply(this, arguments); }

        /* otherwise */
        return callback.apply(this, arguments);
      });
    };
    sendScript_();
  };

  sendScriptToAll = function(script, callback) {
    var results = _.map(_.range(multi.count), function(x) { return ''; });

    sg.__eachll(_.range(multi.count),
      function(childNum, nextChild) {
        return sendScript(script, childNum, function(err, result) {
          if (!err) {
            results[childNum] = result;
          }
          return nextChild();
        });
      },

      function done() {
        return callback(null, results);
      }
    );
  };

  sendScriptToAllJSON = function(script, callback) {
    var results = _.map(_.range(multi.count), function(x) { return {}; });

    sg.__eachll(_.range(multi.count),
      function(childNum, nextChild) {
        return sendScript(script, childNum, function(err, result) {
          if (!err) {
            try {
              results[childNum] = JSON.parse(result);
            } catch(err) {
              results[childNum] = {error: 'NOTJSON', err:err, result:result};
            }
          }
          return nextChild();
        });
      },

      function done() {
        return callback(null, results);
      }
    );
  };

  evaluate = function(fn, callback) {
    var fnStr = '(' + fn.toString() + '());';
    return sendScriptToAllJSON(fnStr, callback);
  };

  scatterGather = function(childFn, gatherFn, doneFn) {
    var fnStr = '(' + childFn.toString() + '());';
    return sendScriptToAllJSON(fnStr, function(err, results) {
      _.each(results, function(result, childNum) {
        gatherFn.apply(this, arguments);
      });

      return doneFn(err);
    });
  };

  // ---------- Create function to parcel out data ----------
  ingest = function(filename, callback) {
    return fs.readFile(filename, 'utf8', function(err, content) {
      if (err) { return callback(err); }

      /* otherwise */
      var lines = content.split('\n');

      // Loop over all the children, and find the items that are destined for
      // that child.  Build an array.
      sg.__eachll(_.range(multi.count),
        function(childNum, nextChild) {

          var index = -1;
          var childItems = _.filter(lines, function(line) {

            if (++index >= multi.count) { index = 0; }
            return (index === childNum);
          });

          //var script = 'd = (global.d || []).concat(' + JSON.stringify(childItems) + ');';
          var script = 'ingest(' + JSON.stringify(childItems) + ', async());';
          return sendScript(script, childNum, function() {
            return nextChild();
          });
        },

        function() {
          if (global.gc) { global.gc(); }

          return callback();
        }
      );
    });
  };

  var listenForMultiScripts = function() {
    var port = 9999;

    var server = net.createServer({allowHalfOpen:true});

    server.on('connection', function(connection) {

      var chunks = [], length = 0;
      connection.on('data', function(chunk) {
        chunks.push(chunk);
        length += chunk.length;
      }); 

      connection.on('end', function() {
        return sendScriptToAll(chunks.join('').toString(), function(err, results) {
          if (err) {
            connection.write('' + util.inspect(err));
          } else {
            connection.write(JSON.stringify(results));
          }

          connection.end();
        }); 

      }); 
    }); 

    console.log('Multi- broadcast port: ' + port);
    server.listen(port);

    return server;
  };

  main();
}());

