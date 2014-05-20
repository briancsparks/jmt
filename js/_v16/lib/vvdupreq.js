
(function() {
  var callback = async();

  var results = {}, big = {}, vbig = {}, report = {};
  sg.__run([
      function(next) {
        return scatterGather(function() {
          // This is evaluated in each child
          var callback = async();

          var histo = {};

          var url, ip, time, paths, key;
          eachRecord(function(record) {
            time  = record[0]
            ip    = record[2];
            url   = record[6];
            paths = url.paths;

            //if (paths && paths.length > 0 && paths[0].toLowerCase() === 'projects') {
              key = time + ':' + ip + '~' + url.pathname;
              histo[key] = (histo[key] || 0) + 1;
            //}

            //if (paths && paths.length > 2 && paths[0].toLowerCase() === 'projects') {
            //  if (paths[2] === 'print_options') {
            //    key = time + ':' + ip;
            //    histo[key] = (histo[key] || 0) + 1;
            //  }
            //}
            
          });

          return callback(null, histo);
        }, function(histo, childNum) {
          var parts;
          _.each(histo, function(value, key) {
            results[key] = (results[key] || 0) + value;
            if (results[key] > 1) {
              big[key] = results[key];
              if (results[key] > 2) {
                vbig[key] = results[key];

                parts = key.split('~');
                report[parts[1]] = report[parts[1]] || {};
                report[parts[1]][parts[0]] = results[key];
              }
            }
          });
        }, function(err) {
          return next();
        });
      }
    ], function() {
      var msg = [];
      _.each(report, function(item, pathname) {
        msg.push(pathname);
        _.each(item, function(value, timeAndIp) {
          msg.push('    ' + timeAndIp + '  ' + value);
        });
      });

      var counts = {}, allIps = {}, ipBigCounts = {}, ipBigCounts_ = {}, ip;
      _.each(results, function(value, key) {
        counts[value] = (counts[value] || 0) + 1;

        ip = key.split(':')[1].split('~')[0];
        allIps[ip] = (allIps[ip] || 0) + value;
        if (value !== 1) {
          ipBigCounts_[ip] = (ipBigCounts_[ip] || 0) + 1;
        }
      });

      _.each(ipBigCounts_, function(count, ip) {
        if (count > 6) {
          ipBigCounts[ip] = count;
        }
      });

      msg.push(JSON.stringify(counts));
      msg.push(JSON.stringify({ipCount: _.keys(allIps).length, ipBigCounts: ipBigCounts}));

      return callback(null, msg.join('\n'));
    }
  );
}());

// {"print_confirmation":23011,"print_options":63307,"checkout_error":427,"animation":8678,"ready_to_print_pdf":25304,"undefined":56344,"generate_text_layer":40556,"verify_recipient":994,"check_for_generate_pdf_completion":43984,"display_error":255,"print_pdf":28930,"show_pdf_in_iframe":27257,"show_animation":17772,"print_activex":7049,"HttpURLConnection.class":406,"generate_jpeg":22032,"check_for_get_card_info_completion":118176,"email_delivery":8434,"":10388,"checkout_success":1316,"print":8879,"status":13770,"deliver_email":6801,"checkout_back":196,"send_card":798,"sun":1909,"camera_roll":2144,"facebook_delivery":207,"print_later":481,"print_folding_instructions":279,"check_email":278,"verify_email":360,"jndi.properties":2,"error":65,"com":15,"js-agent.newrelic.com":1,"show_animation%3E":2,"images":38,"delivery_options":1,"box_display.php":4,"beacon-2.newrelic.com":1,"activex":1,"default.class":2,"status%20-":1,"generate-jpeg":1,"animation%20-%20":1,"demo":2,"sp.gif":2,"show_animation.":1,"show_animationhttp:":2,"folded_instructions":1,"print_option":1}

