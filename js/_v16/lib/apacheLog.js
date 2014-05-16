/**
 *  @fileOverview: Do a first-pass optimization of the data, assuming
 *  it is apache log file formatted;  Provide helper functions for 
 *  dealing with apache formatted log entries.
 */

(function() {
  // We want to run async
  var callback = async();

  var result = {};                          // The result of processing
  var dash = '-';                           // A single copy of this much-used string
  var dict = {}, queryDict = {};            // Objects to hold duplicate strings

  dict['paths'] = dict['paths'] || {};      // An object to hold duplicate strings in URL paths

  /**
   *  The main() function.
   *
   *  The real meat of the module is here at the top of the file, and helpers are below.
   */
  var main = function() {

    sg.__run([

      /*
       *  Remove records that have little valuable information
       *
       *  * Mal-formed (NF < 10)
       *  * Infrastructure-probing (408)
       *  * Monitors / spiders
       */
      function(next) {
        //return next();
        var remove;               // Declare here, so we don't create and destroy it inside the main loop

        result.seen     = 0;      // How many records did we see on the first pass?
        result.removed  = 0;      // How many were removed by this function?
        result.noisy    = {};     // Histogram of noisy records

        // Loop over each record...
        eachRecord(function(record, index, column) {
            remove = false;
            result.seen++;

            // ...determine if we want to delete it...
            if (record.length < 10)                               { remove = 'tooSmall'; }
            else if (record[6] == 408)                            { remove = '408'; }
            else if (/^(Apache|ELB|NewRelic)/.exec(record[11]))   { remove = 'monitor'; }

            // ... if so, remove it
            if (remove) {
              result.removed++;
              result.noisy[remove] = (result.noisy[remove] || 0) + 1;
              delete column[index];

            // ... if not, clobber low-value individual fields
            } else {
              // server name, http version, user agent
              column[index][1] = column[index][7] = column[index][11] = dash;
            }
          }, 

          // After each column, run the garbage collector
          function() {
            global.gc();
          }
        );

        console.log('Pruned ' + result.removed + ' of ' + result.seen + ' total records (' + Math.floor(100 * result.removed/result.seen) + '%).');
        var msg = _.map(result.noisy, function(count, key) {
          return '\t' + key + ': ' + count;
        });
        console.log(msg.join('\n'));

        // We've removed many records; compact the data set
        compactData();
        return next();
      },

      /*
       *  Hide records that may not need to be fully parsed.
       *
       *  * Assets and text-layer
       */
      function(next) {
        //return next();
        var hide;               // Declare here, so we don't create and destroy it inside the main loop

        result.hidden   = 0;      // How many were hidden by this function?
        result.hNoisey   = {};     // Histogram of noisy records

        // Loop over each record...
        eachRecord(function(record, index, column) {
            hide = false;
            result.seen++;

            // ...determine if we want to hide it...
            if (/^.assets/i.exec(record[6]))                      { hide = 'assets'; }
            else if (/^.generatetextlayer/i.exec(record[6]))      { hide = 'gtl'; }

            // ... if so, hide it
            if (hide) {
              result.hidden++;
              result.hNoisey[hide] = (result.hNoisey[hide] || 0) + 1;

              // This line changes the field from a string to an object.  This keeps other 
              // functions from working on it
              column[index][6]  = {just: record[6]};
              column[index][10] = {just: record[10]};
            }
          }, 

          // After each column, run the garbage collector
          function() {
            global.gc();
          }
        );

        console.log('Hid ' + result.hidden + ' of ' + result.seen + ' total records (' + Math.floor(100 * result.hidden/result.seen) + '%).');
        var msg = _.map(result.hNoisey, function(count, key) {
          return '\t' + key + ': ' + count;
        });
        console.log(msg.join('\n'));

        return next();
      },
      
      /*
       *  Remove records that are valid, but are way too plentiful
       */
      function(next) {
        //return next();    // Skip for now

        var url;

        result.numNoisyRemoved = 0;

        eachRecord(
          function(record, index, column) {
            url = record[6];

            // If the URL has been hidden:
            if (url.hasOwnProperty('just')) {
              if (/^.(assets|generatetextlayer)/i.exec(url.just)) {
                delete column[index];
                result.numNoisyRemoved++;
              }
            }
          },
          function() {
            global.gc();
          }
        );
        compactData();
        global.gc();

        console.log('Removed ' + result.numNoisyRemoved + ' noisy records');
        return next();
      },

      /*
       * Convert the URL and referer fields into objects
       *
       * * Make sure we are parsing a string (it may have already been parsed
       * * Try and minimize memory requirements
       */
      function(next) {
        //return next();

        result.urlSeen = 0;         // Remember how many URLs we've seen and processed
        result.nfHist  = {};        // Make a histogram of the number of fields

        // Loop over each record...
        eachRecord(
          function(record, index, column) {
            result.urlSeen++;
            result.nfHist[record.length] = (result.nfHist[record.length] || 0) + 1;

            // ... process the URL field...
            if (record.length < 7) { return; }

            url = record[6];
            if (typeof url === 'string' && url.length > 0) {
              record[6] = minifyUrlObject(url);
            } else {
              reportBadRecord(record, 6);
            }

            // ...process the referer field...
            if (record.length < 11) { return; }

            // ... and minify the resultant object
            url = record[10];
            if (typeof url === 'string' && url.length > 0) {
              record[10] = minifyUrlObject(url);
            } else {
              reportBadRecord(record, 10);
            }
          }, 

          // On each column, run garbage collection
          function() {
            global.gc();
          }
        );

        console.log('Converted ' + result.urlSeen + ' URLS');
        return next();
      },
      
      /*
       *  Remove records that are valid, but are way too plentiful
       */
      function(next) {
        return next();    // Skip for now

        var url;

        result.numNoisyRemoved = 0;

        eachRecord(
          function(record, index, column) {
            url = record[6];

            // If the URL has been parsed:
            if (url.hasOwnProperty('paths') && url.paths[0] === 'assets') {
              delete column[index];
              result.numNoisyRemoved++;
            }
          },
          function() {
            global.gc();
          }
        );
        compactData();
        global.gc();

        console.log('Removed ' + result.numNoisyRemoved + ' asset records');
        return next();
      }],

      /*
       *  Done!!
       *
       *  Return the result
       */
      function done() {
        return callback(null, result);
      }
    );
  };

  /**
   *  This function makes the URL much faster to query (make it an object, not a string), while still
   *  using minimal space:
   *
   *  * Any property that is null, undefined, or a zero-length string is deleted.
   *  * Any property that is all digits is changed to a number
   *  * Removal of properties that are the unparsed string
   */
  var minifyUrlObject = function(urlString) {
    var value, paths, url = urlLib.parse(urlString, true);

    // Kill the noisy properties
    delete url['search'];
    delete url['path'];
    delete url['href'];
    delete url['hostname'];

    delete url['message'];
    delete url.query['message'];

    // Apply the above rules to the top-level of the URL object
    _.each(_.keys(url), function(key) {
      value = url[key];

      if (value === null || value.length === 0) {
        delete url[key];
      } else if (/^[0-9]+$/.exec(value)) {
        url[key] = parseInt(value, 10);
      } else {
        dict[key] = dict[key] || {};
        url[key]  = dict[key][value] = (dict[key][value] || value);
      }
    });

    if (url.pathname) {
      paths = _.rest(url.pathname.split('/'));
      if (paths.length > 0) {
        url.paths = [];
        _.each(paths, function(str) {
          url.paths.push(dict.paths[str] = (dict.paths[str] || str));
        });
      }
    }

    // Apply the above rules to the query sub-object
    var keys = _.keys(url.query);
    if (keys.length > 0) {
      _.each(keys, function(key) {
        value = url.query[key];

        if (value === null || value.length === 0) {
          delete url.query[key];
        } else if (/^[0-9]+$/.exec(value)) {
          url.query[key] = parseInt(value, 10);
        } else {
          queryDict[key] = queryDict[key] || {};
          url[key]       = queryDict[key][value] = (queryDict[key][value] || value);
        }
      });
    } else {
      delete url['query'];
    }

    return url;
  };

  /**
   *  When an above function finds a URL that is bad, it skips it, but
   *  also calls this function to report it.  This function knows that
   *  some URLs / records are just weird, so it suppresses the warning for those.
   */
  var reportBadRecord = function(record, index) {
    var url = record[index];

    // These are OK
    if (_.isObject(url)) { return; }
    if (typeof url === 'number' && url >= 0 && url <= 999 && record.length === 10) { return; }

    /* Hmmmmmm... */
    console.error('Is this a url? ' + url + ' NF: ' + record.length + ' (' + record.join(' ') + ')');
  };

  main();

}());

