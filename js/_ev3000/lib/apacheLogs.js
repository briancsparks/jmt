
var maxField = d.std.strings.length - 1;
d.std.rawList.process = function(rawList, options, callback) {
  var list = _.map(rawList, function(record) {
    //return record.split(/[ \t]+/);

    var fields = _.map(record.split(/[ \t]+/), function(field, index) {
      if (/^[0-9]+/.exec(field)) { return parseInt(field, 10); }
      if (index > maxField) { index = maxField;}

      if (index === 11) {
        field = '-';
      }
      else if (index === 6) {
        field = _.first(field.split('#', 1)[0].split('?', 1)[0].split('/'), 2).join('/');
      }
      else if (index === 10) {
        field = _.first(field.split('#', 1)[0].split('?', 1)[0].split('/'), 4).join('/');
      }

      d.std.strings[index][field] = (d.std.strings[index][field] || field);
      return d.std.strings[index][field];
    });

    return fields;
  });

  return callback(null, list, options);
};

