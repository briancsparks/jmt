
(function() {
  var urlLib          = require('url');
  var skwish          = d.std.skwish;

  var url, parts;

  var maxField = d.std.rawList.strings.length - 1;

  d.std.rawList.processRecord = function(record, record_) {
    var fields = _.map(record, function(field_, index) {
      if (field_ !== null) { return field_; }
      var field = record_[index];

      if (/^[0-9]+$/.exec(field)) { return parseInt(field, 10); }
      if (index > maxField) { index = maxField;}

      if (index === 11) {   /* User-Agent */
        field = '-';
      }

      else if (index === 6 || index === 10) {     /* url and referer */
        url = urlLib.parse(field, true);
        delete url.search;
        delete url.path;
        delete url.href;

        field = skwish(url, index);

      } else if (index === 0) {               /* time */
        parts = field.split('/');
        if (parts.length === 6) {
          field = (new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])).getTime();
        }
      } else {
        field = d.std.rawList.strings[index][field] = (d.std.rawList.strings[index][field] || field);
      }

      return field;
    });

    return fields;
  };

  return 'Loaded apacheLogs processor';
}());

