
(function() {
  var callback = async();

  var results = {};
  sg.__run([
      function(next) {
        return evaluate(function() {
          var callback = async();
          init('vv', {});

          isGuid = function(str) {
            var lengths = _.map(str.split('-'), function(part) {
              return part.length;
            });
            if (lengths !== 5) { return false; }
            if (lengths[0] !== 8 || lengths[1] !== 4) { return false; }   // TODO: do all the lengths

            return true;
          };

          return callback();
        }, function(err, results) {
          return next();
        });
      },

      function(next) {
        return evaluate(function() {
          // This gets run in each child
          var callback = async();
          var result = {count:0, total:0};

          var print_actions = {
            print_pdf     : true,
            print_activex : true,
            deliver_email : true
          };

          eachRecord(function(record) {
            var url   = record[6];
            var paths = url.paths, guid;

            result.total++;

            if (paths && paths.length > 0 && paths[0].toLowerCase() === 'projects') {
              result.count++;
              tag(record, 'project');

              if (paths.length > 1 && isGuid(paths[1])) {
                guid = paths[1];
                vv[guid] = vv[guid] || {};
              }

              if (paths.length > 2 && print_actions[paths[2]]) {
                tag(record, 'project_with_action');
                tag(record, paths[2]);
              }
            }
          });

          return callback(null, result);
        }, function(err, results_) {
          // This gets run in the parent

          //results = results_;
          return next();
        });
      },

      function(next) {
        return scatterGather(function() {
          // This is evaluated in each child
          var callback = async();

          var histo = {};
          //enumTagged('project_with_action', function(record) {
          enumTagged('project', function(record) {
            var action = record[6].paths[2];
            histo[action] = (histo[action] || 0) + 1;
          });

          return callback(null, histo);
        }, function(histo, childNum) {
          _.each(histo, function(value, key) {
            results[key] = (results[key] || 0) + value;
          });
        }, function(err) {
          return next();
        });
      }
    ], function() {
      return callback(null, results);
    }
  );
}());

