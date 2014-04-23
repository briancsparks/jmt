
(function() {
  var urlLib          = require('url');
  var skwish          = d.std.skwish;
  var url;

  var maxField = d.std.rawList.strings.length - 1;

  d.std.rawList.processRecord = function(record, record_) {
    var fields = _.map(record, function(field_, index) {
      if (field_ !== null) { return field_; }
      var field = record_[index];

      if (/^[0-9]+/.exec(field)) { return parseInt(field, 10); }
      if (index > maxField) { index = maxField;}

      if (index === 11) {
        field = '-';
      }
      else if (index === 6 || index === 10) {
        field = skwish(urlLib.parse(field, true), index);
      } else {
        field = d.std.rawList.strings[index][field] = (d.std.rawList.strings[index][field] || field);
      }

      return field;
    });

    return fields;
  };

  return 'Loaded apacheLogs processor';
}());
