
/**
 *  sg!
 */

var _             = require('underscore');
var fs            = require('fs');
var util          = require('util'), sys = util;
var glob          = require('glob');
var path          = require('path');
var EventEmitter  = require('events').EventEmitter;
var exec          = require('child_process').exec;


var slice = Array.prototype.slice;
var lib = {};
var shutdownHandlers = [];

var firstKey = lib.firstKey = function(obj) {
  for (var k in obj) {
    return k;
  }
  return ;
};

var numKeys = lib.numKeys = function(obj) {
  var num = 0;
  for (var k in obj) {
    num++;
  }

  return num;
};

var kv = lib.kv = function(o, k, v) {
  o = o || {};
  o[k] = v;
  return o;
};

var die = lib.die = function(code_, msg_) {
  var args = Array.prototype.slice.apply(arguments);
  var code = _.isNumber(args[0]) ? args.shift() : 1;

  args.unshift(args.shift() || "Fatal Error");
  console.error.apply(this, args);
  process.exit(code);
};

var protector = lib.protector = function(errback_, options_) {
  var errback   = errback_ || function() {};
  var options   = options_ || {};

  return function(callback) {
    return function(err) {
      if (err) { return errback.call(options.errbackBinding || this, err, {args:arguments, context:options.context}); }

      return callback.apply(this, arguments);
    };
  };
};

var haltOnError = lib.haltOnError = protector(function(err, info) {
  console.error("!!!Halting on error!!!" + info.context? sys.inspect(info.context) : '');

  die.apply(this, [9].concat(_.rest(info.args)));
});

var or_die = lib.or_die = lib.die_trying = haltOnError;

var on_err = lib.on_err = lib.on_error = function(errback, callback) {
  return protector(errback)(callback);
};

var ezJsonParse = lib.ezJsonParse = function(str) {
  str = str.replace(/([0-9a-z_]+)(\s*):/ig, function(m, p1, p2) {
    return '"' + p1 + '"' + p2 + ':';
  });
  try {
    return JSON.parse(str);
  } catch(err) {
    return null;
  }
};

var pad = lib.pad = function(str_, width, ch_) {
  var ch = ch_ || ' ';

  var str = str_.toString();
  while(str.length < width) {
    str = ch + str;
  }
  return str;
};

var printf = lib.printf = function(fmt) {
  var params = _.rest(arguments);
  var theReplacement = fmt.replace(/(%([0-9]*)s([0-9]))/g, function(m, p, w, argNum) {
    var repl = params[argNum-1];
    if (w.length > 0) {
      if (w[0] === '0') {
        repl = pad(repl, w, '0');
      } else {
        repl = pad(repl, w);
      }
    }

    return repl;
  });

  return theReplacement;
};

var context = lib.context = function(key, def) {
  var keyIndex = -1;
  for (var i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--" + key) {
      keyIndex = i;
      break;
    }
  }

  if (keyIndex >= 0 && keyIndex+1 < process.argv.length) {
    return process.argv[keyIndex + 1];
  }

  if (def) {
    return def;
  }
};

var captures = lib.captures = function(re, str, callback) {
  var m = re.exec(str);
  if (!m) { return callback(); }

  return callback.apply(this, [m].concat(_.slice(m)));
};

var capturesSync  = lib.capturesSync = function(re, str) {
  var m = re.exec(str);
  if (!m) { return ''; }

  return Array.prototype.slice.apply(m);
};

var Promise = lib.Promise = function(handler1) {
  var self = this;

  self.handler = handler1;
  self.then = function(handler2) {
    self.handler = handler2;
  };

  self.go = function(err) {
    return self.handler.apply(this, arguments);
  };
};

var delayStart = lib.delayStart = function(delayedFunction, retVal) {
  process.nextTick(delayedFunction);
  return retVal;
};

var __each = lib.__each = function(a, b, c) {
  // If the caller has a named function, like 'next', it is easier to call this
  // function with that name first
  if (_.isFunction(a)) { return __each_(b, c, a); }

  // Normal
  return __each_(a, b, c);
};

var __each_ = function(coll, fn, callback) {

  if (coll.length <= 0) {
    return callback();
  }

  var i = 0, end;
  var indexes, values, errors, hasError = false;

  var continuation = new Promise(callback);

  if (_.isArray(coll)) {
    indexes = _.range(coll.length);
    values = [];
    errors = [];
  }
  else {
    indexes = _.keys(coll);
    values = {};
    errors = {};
  }

  end = indexes.length;

  var doOne = function() {
    var item = coll[indexes[i]];
    var next = function(err, val) {
      if (err) { hasError = true; }

      errors[i] = err;
      values[i] = val;

      i += 1;
      if (i < end) {
        return process.nextTick(function() {
          doOne();
        });
      }

      return continuation.go(hasError ? errors : null, values);
    };

    return fn(item, next, indexes[i]);
  };

  return delayStart(doOne, /* return: */continuation);
};

var __eachll = /*lib.__eachll =*/ function(coll, fn, callback) {
  var finalFn = _.after(coll.length, function() {
    callback();
  });

  for (var i = 0, l = coll.length; i < l; i++) {
    fn(coll[i], finalFn, i);
  }
};

var __eachll2 = lib.__eachll = function(list_, max_, fn_, callback_) {

  var list = list_.slice();
  var args = _.rest(arguments);
  var callback = args.pop();
  var fn = args.pop();
  var max = args.length > 0 ? args.shift() : 10000000;

  var outstanding = 0;
  var launch = function(incr) {
    outstanding += (incr || 0);

    if (list.length > 0 && outstanding < max) {
      outstanding++;
      fn(list.shift(), function() {
        process.nextTick(function() {
          launch(-1);
        });
      });
      process.nextTick(launch);
    }
    else if (list.length === 0 && outstanding === 0) {
      callback();
    }
  };
  launch();
};

//sg.__eachll('abcdefghijklmnopqrstuvwxyz'.split(''), //4,
//  function(x, next) {
//    var time = Math.random() * 10000;
//    console.log(x + ' ' + time);
//    setTimeout(function() {
//      console.log(x);
//      next();
//    }, time);
//  },
//  function done() {
//    console.log('done');
//  }
//);

var __run = lib.__run = function(fns, callback_) {
  var callback = callback_ || function() {};
  return __each(fns, 
    function(fn, next) {
      return fn(next);
    }, 

    function() {
      return callback();
    }
  );
};

var findFiles = lib.findFiles = function(pattern, options, callback) {
  return glob(pattern, options, function(err, filenames_) {
    if (err) { return callback(err); }

    var filenames = [];
    return __eachll(filenames_, 
      function(filename, next) {
        return fs.stat(filename, function(err, stats) {
          if (!err && stats.isFile()) {
            filenames.push(filename);
          }
          return next();
        });
      },
      function(errs) {
        return callback(null, filenames);
      }
    );
  });
};

var eachLine = lib.eachLine = function(pattern, options_, eachCallback, finalCallback) {
  var options = _.defaults({}, options_ || {}, {cwd: process.cwd()}),
      total = 0;

  var eachLineOneFile = function(filename, next) {
    return fs.readFile(path.join(options.cwd, filename), 'utf8', function(err, contents) {
      if (err) { return next(err); }

      var lines = contents.split('\n');
      if (options.lineFilter) {
        lines = lines.filter(options.lineFilter);
      }

      var i = 0, l = lines.length;
      var oneLine = function() {
        total++;
        var result = eachCallback(lines[i], i, filename, total);
        if (result === 'SG.nextFile') {
          return next();
        }

        i += 1;

        if (i < l) {
          if (result === 'SG.breathe') {
            //console.log('Breathing');
            return setTimeout(oneLine, 500);
          }
        
          if (i % 200 === 0) {
            return process.nextTick(oneLine);
          }

          return oneLine();
        }

        return next();
      };

      return oneLine();

      //for (var i = 0, l = lines.length; i < l; ++i) {
      //  total++;
      //  var result = eachCallback(lines[i], i, filename, total);
      //  if (result === 'SG.nextFile') {
      //    return next();
      //  }
      //}

      //return next();
    });
  };

  // Is this a glob?
  if (!/\*/.exec(pattern)) {
    // No, not a glob
    return eachLineOneFile(arguments[0], function(err) {
      return finalCallback(err, total);
    });
  }

  /* otherwise */
  options.filenameFilter = options.filenameFilter || function(){return true;};

  return glob(pattern, options, function(err, files) {
    if (err) { return finalCallback(err); }

    return __each(files, 
      function(filename, next) {

        return fs.stat(filename, function(err, stats) {
          if (err) { return next(); }
          if (!stats.isFile()) { return next(); }

          if (!options.filenameFilter(filename)) { return next(); }

          return eachLineOneFile(filename, next);
        });
      },
      
      function() {
        return finalCallback(null, total);
      }
    );
  });
};

var parseOn2Chars = lib.parseOn2Chars = function(str, sep1, sep2) {
  var ret = {};
  _.each(str.split(sep1).filter(_.identity), function(kv) {
    var arr = kv.split(sep2), k = arr[0], v = arr[1];
    ret[k.toLowerCase()] = v.toLowerCase();
  });

  return ret;
};

var exportify = lib.exportify = function(obj) {
  for (var key in obj) {
    exports[key] = obj[key];
  }
};

var lineNum = 0;
var remainder = '';
var ARGF = lib.ARGF = function(callback, fnDone_) {
  var fnDone = fnDone_ || function() {};

  var doOneLine = function(line) {
    lineNum++;
    callback(line, lineNum);
  };

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', function(chunk) {
    remainder += chunk;
    var lines = remainder.split('\n');
    remainder = lines.pop();

    _.each(lines, doOneLine);
  });

  process.stdin.on('end', function() {
    var lines = remainder.split('\n');
    _.each(lines, doOneLine);
    fnDone();
  });
};

var awk = lib.awk = function(callback, fnDone_) {
  return ARGF(function(line, lineNum) {
    return callback(line.split(' '), lineNum);
  }, fnDone_);
};

var TheARGV = function(params_) {
  var self = this;

  var params = params_ || {};

  self.executable = process.argv[0];
  self.script = process.argv[1];
  self.flags = {};
  self.args = [];

  self.setFlag = function(key, value) {
    self.flags[key] = value;
    if (self.flags.hasOwnProperty(key) || !self.hasOwnProperty(key)) {
      self[key] = value;
    }
    if (params.short && params.short[key]) {
      self.setFlags(params.short[key], value);
    }
  };

  // Initialize -- scan the arguments
  var curr;
  for (var i = 2; i < process.argv.length; i++) {
    var next = i+1 < process.argv.length ? process.argv[i+1] : null;
    var m, m2;

    curr = process.argv[i];
    //console.log("ARG Raw, next: ", curr, next);

    // --foo=bar, --foo=
    if ((m = /^--([a-zA-Z_0-9\-]+)=([^ ]+)/.exec(curr)) && m.length === 3) {
      //console.log("ARG Recognized as --foo=bar " + curr);
      self.setFlag([m[1]], m[2]);
    }
    // --foo-
    else if ((m = /^--([^ ]+)-/.exec(curr))) {
      //console.log("ARG Recognized as '--foo-' " + curr);
      self.setFlag([m[1]], false);
    }
    // --foo= bar
    else if ((m = /^--([^ ]+)=/.exec(curr)) && next && (m2 = /^([^\-][^ ]*)/.exec(next))) {
      //console.log("ARG Recognized as '--foo bar' " + curr);
      self.setFlag([m[1]], m2[1]);
      i++;
    }
    // --foo
    else if ((m = /^--([^ ]+)/.exec(curr))) {
      //console.log("ARG Recognized as '--foo' " + curr);
      self.setFlag([m[1]], true);
    }
    // -f-
    else if ((m = /^-(.)-/.exec(curr))) {
      //console.log("ARG Recognized as '-f-' " + curr);
      self.setFlag([m[1]], true);
    }
    // -f bar
    else if ((m = /^-(.)/.exec(curr)) && next && (m2 = /^([^\-][^ ]*)/.exec(next))) {
      //console.log("ARG Recognized as -f bar " + curr);
      self.setFlag([m[1]], m2[1]);
      i++;
    }
    // -f
    else if ((m = /^-(.)/.exec(curr))) {
      //console.log("ARG Recognized as '-f' " + curr);
      self.setFlag([m[1]], true);
    }
    else if (curr === '--') {
      break;
    }
    else {
      //console.log("ARG Argument: " + curr);
      self.args.push(curr);
    }
  }

  for (; i < process.argv.length; i++) {
    curr = process.argv[i];
    self.args.push(curr);
  }
};

var redisEncode = lib.redisEncode = function(list) {

  if (_.isString(arguments[0])) { return redisEncode(arguments[0].split(/\s+/)); }

  var ret = '*' + list.length + '\r\n';
  _.each(list, function(item_) {
    var item = item_.toString();
    ret += '$' + item.length + '\r\n';
    ret += item + '\r\n';
  });

  return ret;
};

var RedisDecoder = lib.RedisDecoder = function(callback) {
  var self = this;

  var remainder = '';
  self.write = function(chunk) {
    //var items = (remainder + chunk).split(/(\r\n|^)\*/);
    var items = (remainder + chunk).split(/\r\n/);
    remainder = items.pop();
    return dispatchItems(items);
  };

  self.end = function() {
    return dispatchItems(remainder.split(/(\r\n|^)\*/));
  };

  // Parsing Redis bulk-reply string.  The only tricky thing is that bulk strings
  // are two lines: $6\r\nfoobar\r\n where everything else is one.  Except for the NULL
  // string, which is one line: $-1\r\n  Actually, arrays are not handled
  var dispatchItems = function(items_) {

    var items = [];
    for (var i = 0; i < items_.length; ++i) {
      if (items_[i][0] !== '$') {
        items.push(items_[i]);
        continue;
      }
      if (items_[i].length === 3 && items_[i][1] === '-' && items_[i][2] === '1') {
        items.push(items_[i]);
        continue;
      }
      if (i + 1 < items_.length) {
        items.push([items_[i], items_[i+1]].join('\r\n'));
        i++;
        continue;
      }

      remainder += items_[i];
    }

    _.each(items, function(item) {
      var lines = item.split('\r\n'), m, len = null, ret = [];
      for (var i = 0; i+1 < lines.length; i += 2) {
        // The first item should be $len
        m = /^\$([0-9])+$/.exec(lines[i]);
        if (m) {
          len = parseInt(m[1], 10);
        }
        else {
          console.error('Parse error from redisDecoder');
        }
        ret.push(lines[i+1]);
      }

      if (theProfiler) {
        theProfiler.count('redis-parse');
      }
      callback(ret.join(' '));
    });
  };
};

var Redis = lib.Redis = function(options_) {
  var self = this;

  var ARGV = lib.ARGV();

  //var options = _.extend((options_ || {}), {port: ARGV.port});
  var options = _.extend({port: ARGV.port}, (options_ || {}));

  self.events = new EventEmitter();

  console.log('connecting to ' + options.port, util.inspect(options_));
  var server = require('net').connect({port: options.port}, function(){ });
  var emitter = new EventEmitter();

  // Load scripts
  var loadedScripts = {}, loadedLibScript = '';
  if (process.env.jmt_dir) {
    __run([
      function(next) {
        findFiles(path.dirname(__filename) + '/../../sh/_redis/_lua/_lib/*.lua', {}, function(err, filenames) {
          if (err) { return; }

          __each(next, filenames, function(filename, nextFilename) {
            var reportErr = function(err) {
              if (err) { console.error('Error while loading ' + filename, err); }
              return nextFilename(err);
            };

            return fs.readFile(filename, function(err, contents) {
              if (err) { return reportErr(err); }

              loadedLibScript += '\n' + contents;
              return nextFilename();
            });
          });
        });
      },
      function(next) {
        findFiles(path.dirname(__filename) + '/../../sh/_redis/_lua/*.lua', {}, function(err, filenames) {
          if (err) { return; }

          __each(next, filenames, function(filename, nextFilename) {
            var reportErr = function(err) {
              if (err) { console.error('Error while loading ' + filename, err); }
              process.exit(2);
              return nextFilename(err);
            };

            return fs.readFile(filename, function(err, contents) {
              if (err) { return reportErr(err); }

              var cmd = ["redis-cli"];
              if (options.port) { cmd.push('-p', options.port); }
              cmd.push('SCRIPT', 'LOAD');
              cmd.push('"' + loadedLibScript + '\n' + contents + '"');
              //if (ARGV.verbose) { console.error('Loading script: ', cmd, filename); }
              return exec(cmd.join(' '), function(err, stdout, stderr) {
                //if (ARGV.verbose) { console.error('Loaded: ' + filename, stdout); }
                //if (ARGV.verbose) { console.error('Stderr: ', stderr); }
                if (err) { return reportErr(err); }
                if (stdout.match(/ /)) { return reportErr(stdout); }

                loadedScripts[path.basename(filename, '.lua')] = stdout.split("\n")[0];
                return nextFilename();
              });
            });
          });
        });
      }],

      function done() {
        // All scripts loaded
        //if (ARGV.verbose) { console.error('loadedScripts: ', loadedScripts); }
        self.events.emit('loaded');
      }
    );
  }

  self.SCRIPT_LOAD = function(filename /*, prefix_, suffix_, callback*/) {
    var args = _.rest(arguments);
    var callback = args.pop();
    var prefix = args.shift();
    var suffix = args.shift();

    var reportErr = function(err) {
      if (err) { console.error('Error while loading ' + filename, err); }
      return callback(err);
    };

    var cmd = ["redis-cli"];
    if (options.port) { cmd.push('-p', options.port); }
    cmd.push('SCRIPT', 'LOAD');
    //if (ARGV.verbose) { console.error('Loading script: ', cmd, filename); }

    return fs.readFile(filename, function(err, contents) {
      if (err) { return callback(err); }

      cmd.push('"' + (prefix || '') + '\n' + contents + (suffix || '') + '"');

      return exec(cmd.join(' '), function(err, stdout, stderr) {
        //if (ARGV.verbose) { console.error('Loaded: ' + filename, stdout); }
        //if (ARGV.verbose) { console.error('Stderr: ', stderr); }

        if (err) { return callback(err); }
        if (stdout.match(/ /)) { return reportErr(stdout); }

        loadedScripts[path.basename(filename, '.lua')] = stdout.split("\n")[0];
        return callback(null, path.basename(filename, '.lua'));
      });
    });
  };

  shutdownHandlers.push(function() {
    server.end();
  });

  self.on = function() {
    return emitter.on.apply(emitter, arguments);
  };

  var decoder = new RedisDecoder(function(item) {
    if (item[0] === '-') {
      console.error(item);
    }
    //console.log('decoder', item);
    emitter.emit('data', item);
  });

  server.setEncoding('utf8');
  server.on('data', function(chunk) {
    //console.log(chunk);
    //decoder.write(chunk);
  });

  self.dbNum = 0;
  self.SELECT = function(dbNum) {
    self.dbNum = dbNum;
    return self.write('SELECT', dbNum);
  };

  self.RUN_SCRIPT = function(script) {
    var tries = 0;
    if (!(script in loadedScripts) && tries === 0) {
      //if (ARGV.verbose) { console.error('DelayRunning: ' + script + ' ' + loadedScripts[script]); }
      return setTimeout(function(){ self.RUN_SCRIPT(script); }, 1000);
    }

    if (!(script in loadedScripts)) {
      console.error('-----------------ERROR ---------- Calling unknown script: ' + script);
    }
    //if (ARGV.verbose) { console.error('Running: ' + script + ' ' + loadedScripts[script]); }
    //if (ARGV.verbose) { console.error(arguments); }
    return self._varargs('EVALSHA', loadedScripts[script], arguments);
  };

  //var profileName, profileStart;
  //self.startProfile = function(name) {
  //  profileName = name;
  //  profileStart = new Date().getTime();
  //  self.DEL('sg_redis_profile:end', profileName);
  //  self.SET('sg_redis_profile:name', profileName);
  //  self.SET('sg_redis_profile:start', profileStart);
  //};

  //self.endProfile = function() {
  //  var cmd = ["redis-cli"];
  //  if (options.port) { cmd.push('-p', options.port); }

  //  // Must wait until the end key is removed
  //  var waitForEndRemoved = function() {
  //    return exec(cmd.concat(['EXISTS', 'sg_redis_profile:end']).join(' '), function(err, stdout, stderr) {
  //      console.log(err, stdout);
  //      console.error(err, stderr);

  //      var end = new Date().getTime();
  //    });
  //  };
  //  return watiForEndRemoved();
  //  //self.SET('sg_redis_profile:end', end);

  //};

  self.SADD_VALUE = function(key, key_of_value) {
    self.RUN_SCRIPT('sadd_value', 2, key_of_value, key);
  };

  self.SADD_VALUE4 = function(prefix, key_of_obj, type, value) {
    self.RUN_SCRIPT('sadd_value4', 0, prefix, key_of_obj, type, value);
  };

  self.SET_VALUE = function(prefix, key_of_obj, type, value) {
    self.RUN_SCRIPT('set_value', 0, prefix, key_of_obj, type, value);
  };

  self.SET_VALUE_ID = function(prefix, key_of_obj, type, value_key) {
    self.RUN_SCRIPT('set_value_id', 2, key_of_obj, value_key, prefix, type);
  };

  self.SET = function(key, value) {
    return self.write('SET', self._fixkey(key), value);
  };

  self.DEL = function(key) {
    return self.write('DEL', self._fixkey(key));
  };

  self.SADD = function(key) {
    return self._varargs('SADD', self._fixkey(key), arguments);
  };

  self.SREM = function() {
    return self._varargs('SREM', arguments);
  };

  self.SMEMBERS = function() {
    return self._varargs('SMEMBERS', arguments);
  };

  self.SDIFF = function() {
    return self._varargs('SDIFF', arguments);
  };

  self.SDIFFSTORE = function(destination) {
    return self._varargs('SDIFFSTORE', self._fixkey(destination), arguments);
  };

  self.SINTER = function() {
    return self._varargs('SINTER', arguments);
  };

  self.SINTERSTORE = function(destination) {
    return self._varargs('SINTERSTORE', self._fixkey(destination), arguments);
  };

  self.SUNION = function() {
    return self._varargs('SUNION', arguments);
  };

  self.SUNIONSTORE = function(destination) {
    return self._varargs('SUNIONSTORE', self._fixkey(destination), arguments);
  };

  self.ZINCRBY = function() {
    return self._varargs('ZINCRBY', arguments);
  };

  self.KEYS = function(keys, callback) {
    return exec(['redis-cli', '-p', options.port, '-n', self.dbNum, 'KEYS', keys].join(' '), function(err, stdout, stderr) {
      if (err) { return callback(err); }

      return callback(null, _.compact(stdout.split('\n')));
    });
  };

  self.GET = function(key, callback) {
    return exec(['redis-cli', '-p', options.port, '-n', self.dbNum, 'GET', key].join(' '), function(err, stdout, stderr) {
      if (err) { return callback(err); }

      return callback(null, _.compact(stdout.split('\n')));
    });
  };

  self._fixkey = function(keyArray) {
    if (!_.isArray(keyArray)) { return keyArray; }

    var params = _.map(_.rest(keyArray), function(str) {
      return str.toString().replace(/:/g, '~');
    });

    return printf.apply(this, [keyArray[0]].concat(params));
  };

  self._varargs = function() {
    var args = slice.apply(arguments);
    var wargs = [];

    while(args.length > 0) {
      if (!_.isArguments(args[0])) {
        wargs.push(args.shift());
      }
      else {
        var numConsumed = wargs.length;
        wargs = wargs.concat(_.rest(args[0], numConsumed - 1));
        break;
      }
    }

    return self.write.apply(self, wargs);
  };

  self.write = function(a) {
    //if (theProfiler && arguments[0] !== 'ZINCRBY') {
    //  theProfiler.count('redis' + arguments[0]);
    //}
    return server.write(redisEncode(arguments));
  };

};

var RedisNoop = lib.RedisNoop = function(example) {
  var self = this;

  _.each(example, function(item, name) {
    if (_.isFunction(item) && /^[A-Z]+$/.exec(name)) {
      self[name] = function() {};
    }
  });
};

var theProfiler;
var Profiler = lib.Profiler = function(options_) {
  var self = this;
  var options = _.extend({pname:'sg_profile'}, options_);
  var redis = new Redis(options);

  self.count = function(name, filename_) {
    return redis.ZINCRBY(options.pname, 1, name+ (filename_ || ''));
  };

  theProfiler = theProfiler || self;
};


var theARGV = null;
var ARGV = lib.ARGV = function(params) {
  return theARGV || (theARGV = new TheARGV(params));
};

var shutdown = lib.shutdown = function() {
  _.each(shutdownHandlers, function(h) {
    h();
  });
};

process.on('exit', function() {
});


var log2_ = Math.log(2);
var log2Floor = lib.log2Floor = function(x) {
  return Math.floor(Math.log(x)/log2_);
};

lib._ = _;
exportify(lib);

