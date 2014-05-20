/**
 *  @fileOverview: Functionality to manage a data set that is part of a
 *  much larger set of data.
 *
 *  Generally, these are functions to help query and manipulate this data set,
 *  but there are a few functions (like ingest, and its cousins) that handle
 *  insertion of the data.
 */

(function() {
  init('raw',   []);
  init('d',     [[]]);
  init('index', {});

  var dicts = _.map(_.range(30), function() { return {}; });

  var tooManyRaw = 20000, tooManyData = 50000, wayTooManyData = 350000;

  // Weird, but this randomization slows down processing
  //tooManyRaw = Math.floor(tooManyRaw * (Math.random() + 1));

  /**
   *  ingest() -- Put the lines (records) into a temporary variable (raw) so
   *  I can quickly return, then kick off a function to move it from the raw
   *  area to the real data area (d).
   */
  var forcedProcessRaw;
  ingest = function(lines, callback) {
    raw = raw.concat(lines);
    processRaw();

    if (forcedProcessRaw) {
      clearTimeout(forcedProcessRaw);
      forcedProcessRaw = false;
    }

    forcedProcessRaw = setTimeout(function() {
      forcedProcessRaw = false;
      processRaw(true);
    }, 2500);

    return callback(null, raw.length);
  };

  /**
   *  Process the raw records.
   *
   *  1. Break the line apart on whitespace (into an array)
   *  2. Convert any numbers to the Number type
   *  3. Use a dictionary to have one string that is referenced by many objects.
   *  4. Run the garbage collector at the end.
   */
  var numLogged = 0;
  processRaw = function(force) {
    var item;

    if (raw.length >= tooManyRaw || force) {
      if (raw.length > 0) { console.log('Processing ' + raw.length + ' items'); }

      while (raw.length > 0) {
        item = [];
        _.each(raw.shift().split(/ |\t/), function(field_, i) {
          var field = field_, parts;
          if (/^[0-9]+$/.exec(field)) {
            item[i] = parseInt(field, 10);
          } else if (/^[0-9]+(\.[0-9]*)?$/.exec(field)) {
            item[i] = parseFloat(field);
          } else if (/^([0-9]+)?\.[0-9]+$/.exec(field)) {
            item[i] = parseFloat(field);
          //} else if (/^.?20[0-9][0-9][\/0-9]+$/.exec(field)) {
          //  // Looks like a date string ("20xx/...")
          //  parts = field.split('/');
          //  if (parts.length === 6 ) {
          //    item[i] = (new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4], parts[5])).getTime();
          //  }
          }

          if (!item[i]) {
            if (cacheRawField(i, field)) {
              item[i] = dicts[i][field] = (dicts[i][field] || field);
            } else {
              item[i] = field;
            }
          }
        });

        // Add the meta field
        item._ = {tag:{}};

        addToD(item);
      }

      if (global.gc) { global.gc(); }
    }
  };

  /**
   *  Should the field use the dictionary technique?
   */
  cacheRawField = global.cacheRawField || function(fieldNum, field) {
    //return true;
    return fieldNum !== 6 && fieldNum !== 10;
  };

  /**
   *  Add an item to d.
   */
  var dTableNum  = 0;
  var addToD = function(x) {
    if (d[dTableNum].length >= tooManyData) {
      d.push([]);
      dTableNum = d.length - 1;
    }

    d[dTableNum].push(x);
  };

  /*-------------------------------------------------------------------------------------------------------
   *
   * Generally, one-time functions are above, and utilities are below
   *
   *------------------------------------------------------------------------------------------------------- */

  /**
   *  Remove empty items from d.
   */
  compactData = function() {
    var i, j, j2, oldColumn, record;

    // Loop over the columns, create a new one and steal all the non-empty items from 
    // the original column
    for (i = 0; i < d.length; i++) {
      oldColumn = d[i];
      d[i] = [];

      for (j = 0; j < oldColumn.length; j++) {
        if (oldColumn.hasOwnProperty(j)) {
          d[i].push(oldColumn[j]);
        }
      }
    }

    setTimeout(function() {
      global.gc();
    }, 750);
  };

  /**
   *  Send all records to the function (fn); then call fnAfterColumn after each column
   */
  eachRecord = function(fn, fnAfterColumn_, storeResult_) {
    var fnAfterColumn = fnAfterColumn_ || function() {};
    var storeResult   = storeResult_ || function() {};

    // The inner loops get run bazillions of times, don't re-allocate variables.
    var i, j, l, column, record;

    // Loop over the columns (i), and the records (j)
    for (i = 0; i < d.length; i++) {
      column = d[i];
      for (j = 0, l = column.length; j < l; j++) {
        if (column.hasOwnProperty(j)) {
          record = column[j];
          //fn(record, j, column, i);
          storeResult(fn(record, j, column, i));
        }
      }

      fnAfterColumn(i, column);
    }
  };

  tag = function(record /*, tags*/) {
    _.each(_.rest(arguments), function(tag) {
      record._.tag[tag] = true;
    });
  };

  untag = function(record /*, tags*/) {
    _.each(_.rest(arguments), function(tag) {
      record._.tag[tag] = false;
    });
  };

  enumTagged = function(tags_, fn) {
    var tags = tags_;
    if (typeof tags === 'string') { tags = [tags]; }

    var i;
    var tagsLength = tags.length;

    eachRecord(function(record) {
      // If the record is missing any tag, it is not matched
      for (i = 0; i < tagsLength; i++) {
        if (!record._.tag[tags[i]]) { return; }
      }

      /* otherwise */
      fn(record);
    });
  };

  enumIndex = function(name, fn) {
    if (index[name]) {
      _.each(index[name], fn);
    }
  };

  /**
   *  Like _.filter, when the fn returns truthy, add to collection.
   */
  filterIndex = function(name, fn) {
    index[name] = index[name] || [];

    eachRecord(function(record, j, column, i) {
      if (fn.apply(this, arguments)) {
        addToIndex(name, record);
      }
    });
  };

  /**
   *  Add item(s) to an index
   */
  addToIndex = function(name /*, locs*/) {
    var locs = _.rest(arguments);

    //if (locs.length === 1 && _.isArray(locs[0])) {
    //  locs = locs[0];
    //}

    index[name] = index[name] || [];
    _.each(locs, function(loc) {
      addOneToIndex(name, loc);
    });
  };

  /**
   *  Add one item to an index
   */
  addOneToIndex = function(name, loc) {
    index[name].push(loc);
  };

}());

