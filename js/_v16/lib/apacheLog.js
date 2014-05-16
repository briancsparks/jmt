
(function() {
  var callback = async();
  var result = {};
  var dict = {}, queryDict = {};
  var dash = '-';

  /**
   *  A main function so the real meat of the module is here at the top of the file, and
   *  helpers are below.
   */
  var main = function() {

    sg.__run([

      // ----- Save some space -----
      function(next) {
        //return next();    // skip for now

        result.seen    = 0;
        result.removed = 0;

        var remove;

        eachRec(function(record, index, column) {
            remove = false;

            if (record.length < 10) { remove = true; }
            if (record[6] == 408)   { remove = true; }

            if (/^(Apache|ELB|NewRelic)/.exec(record[11])) { remove = true; }

            result.seen++;
            if (remove) {
              result.removed++;
              delete column[index];
            } else {
              // server name, http version, user agent
              column[index][1] = column[index][7] = column[index][11] = dash;
            }
          }, 

          function() {
            global.gc();
          }
        );

        return next();
      },

      // ----- Save some more space -----
      function(next) {
        /*
         * TODO: kill 
         *  sentiment text
         *  size
         *  elapsed
         */
        return next();
      },

      function(next) {
        compactData();
        return next();
      },

      // ----- Convert URL and referer into objects -----
      function(next) {
        //return next();    // skip for now

        result.urlSeen    = 0;
        result.nfHist  = {};

        // The inner loops get run bazillions of times, don't re-allocate variables.
        var i,j,l, column, url, record;

        // Loop over the columns (i), and the records (j)
        for (i = 0; i < d.length; i++) {
          column = d[i];
          for (j = 0, l = column.length; j < l; j++) {
            if (!column.hasOwnProperty(j)) { continue; }

            record = column[j];

            result.urlSeen++;
            result.nfHist[record.length] = (result.nfHist[record.length] || 0) + 1;

            // ----- Process the URL field -----
            if (record.length < 7) { continue; }

            url = record[6];
            if (typeof url === 'string' && url.length > 0) {
              record[6] = minifyUrlObject(url);
            } else {
              if (typeof url === 'number' && url >= 0 && url <= 999 && record.length === 10) {
                // This is OK
              } else {
                console.error('Is this a url? ' + url + ' NF: ' + record.length + ' (' + record.join(' ') + ')');
              }
            }

            // ----- Process the referer field -----
            if (record.length < 11) { continue; }

            url = record[10];
            if (typeof url === 'string' && url.length > 0) {
              record[10] = minifyUrlObject(url);
            } else {
              if (typeof url === 'number' && url >= 0 && url <= 999 && record.length === 10) {
                // This is OK
              } else {
                console.error('Is this a url? ' + url + ' NF: ' + record.length + ' (' + record.join(' ') + ')');
              }
            }
          }

          // Take out the trash
          global.gc();
        }

        return next();
      }],

      function done() {
        return callback(null, result);
      }
    );
  };

  var eachRec = function(fn, fnAfterColumn_) {
    var fnAfterColumn = fnAfterColumn_ || function() {};

    // The inner loops get run bazillions of times, don't re-allocate variables.
    var i, j, l, column, record;

    // Loop over the columns (i), and the records (j)
    for (i = 0; i < d.length; i++) {
      column = d[i];
      for (j = 0, l = column.length; j < l; j++) {
        if (column.hasOwnProperty(j)) {
          record = column[j];
          fn(record, j, column, i);
        }
      }

      fnAfterColumn(i, column);
    }
  };

  /**
   *  A function to make the URL much faster to query (make it an object, not a string), while still
   *  using minimal space:
   *
   *  * Any property that is null, undefined, or a zero-length string is deleted.
   *  * Any property that is all digits is changed to a number
   *  * Removal of properties that are the unparsed string
   */
  var minifyUrlObject = function(urlString) {
    var value, url = urlLib.parse(urlString, true);

    // Kill the noisy properties
    delete url['search'];
    delete url['path'];
    delete url['href'];
    delete url['hostname'];

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

    // Apply the above rules to the query sub-object
    _.each(_.keys(url.query), function(key) {
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

    return url;
  };

  main();

}());

