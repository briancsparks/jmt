/**
 *  @fileOverview: Setup for the child processes
 */

(function() {
  init('raw', []);
  init('d',   [[]]);

  var dicts = _.map(_.range(30), function() { return {}; });

  var tooManyRaw = 10000, tooManyData = 50000, wayTooManyData = 350000;

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

  processRaw = function(force) {
    var item;

    if (raw.length >= tooManyRaw || force) {
      if (raw.length > 0) { console.log('Processing ' + raw.length + ' items'); }

      while (raw.length > 0) {
        item = [];
        _.each(raw.shift().split(/ |\t/), function(field_, i) {
          var field = field_;
          if (/^[0-9]+$/.exec(field)) {
            item[i] = parseInt(field, 10);
          } else if (/^[0-9]+(\.[0-9]*)?$/.exec(field)) {
            item[i] = parseFloat(field);
          } else if (/^([0-9]+)?\.[0-9]+$/.exec(field)) {
            item[i] = parseFloat(field);
          } else {
            item[i] = dicts[i][field] = (dicts[i][field] || field);
          }
        });

        addToD(item);
      }

      if (global.gc) { global.gc(); }
    }
  };

  var dTableNum  = 0;
  var addToD = function(x) {
    if (d[dTableNum].length >= tooManyData) {
      d.push([]);
      dTableNum = d.length - 1;
    }

    d[dTableNum].push(x);
  };

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

}());

