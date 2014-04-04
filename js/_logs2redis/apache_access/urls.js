
var sg        = require('../../utils/sg');
var urlLib    = require('url');
var _         = sg._;

var printf    = sg.printf;

var numHandled = 0, total = 0;

var pathRoots = {
  api:true, cart:true, js:true, lib:true, support:true,
  reprint:true, merchants:true, give:true, video:true, projects:true, users:true, cards:true
};

var ignoreRoots = {
  admin:true, m:true, 
  NovMail:true, novmail:true,
  smile_content:true, smilecontent:true,
  Dec13:true, dec13:true,
  "13octoberemail":true
};

var hackersRoots = {
  'cgi-bin': true, plug:true
};

var _daysPerMonth = {
  '01':31,
  '02':28,
  '03':31,
  '04':30,
  '05':31,
  '06':30,
  '07':31,
  '08':31,
  '09':30,
  '10':31,
  '11':30,
  '12':31
};

var daysPerMonth = function(year, month) {
  if (month === '02' && (year % 4) === 0 && (year % 100) !== 0) {
    return _daysPerMonth[month] + 1;
  }

  return _daysPerMonth[month];
};

var datesSent = {};

exports.filters = [
  
  // Categorize the URL [f7] (at least the easy ones)
  function(emitter) {
    emitter.RUN_SCRIPT('generate_seconds', 0);

    return function(item, slug) {
      total++;

      var ip = item[3],
          url = item[7],
          path = url.split('#', 1)[0].split('?', 1)[0],
          parts = _.rest(path.split('/')),
          theQuery = null;

      var query = function(url_) {
        if (url_) {
          return urlLib.parse(url_, true).query;
        }

        if (theQuery) { return theQuery; }
        theQuery = urlLib.parse(url, true).query;
        return theQuery;
      };

      // Do the bulk of the work by sending to the access_each.lua script
      emitter.RUN_SCRIPT('access_each', 1, 'token:slug:id', 'item_start', item[1], item[2], item[3], item[4], item[6], item[9], item[10], slug);
      emitter.SET_VALUE('slug', 'token:slug:id', 'url', path);

      var handled = false;
      if (parts[0] === 'projects' || parts[0] === 'project') {
        if (parts.length === 3) {
          if (parts[1].match(/[0-9a-fA-F-]+/) && parts[1].split('-').length === 5) {
            emitter.SADD_VALUE(['url', ['', parts[0], 'GUID', parts[2]].join('/'), 'slug_'].join(':'), 'token:slug:id');
            emitter.SADD_VALUE(['guid', parts[1], 'slug_'].join(':'), 'token:slug:id');
            emitter.SET(['slug', slug, 'guid'].join(':'), parts[1]);
            handled = true;
            numHandled++;
          }
          else if (parts[1].match(/^[0-9]+$/)) {
            emitter.SADD_VALUE(['url', ['', parts[0], 'NNN', parts[2]].join('/'), 'slug_'].join(':'), 'token:slug:id');
            emitter.SET(['slug', slug, parts[0].replace(/s$/i, '')].join(':'), parts[1]);
            handled = true;
            numHandled++;
          }
        }
        else if (parts[0] in pathRoots) {
          emitter.SADD_VALUE(['url', path, 'slug_'].join(':'), 'token:slug:id');
          handled = true;
          numHandled++;
        }
      }
      else if (parts.length === 1) {
        var ughSearch = path.split('&');
        if (ughSearch.shift() === '/arts.js') {
          path = '/arts.js';
          emitter.SET(['slug', slug, 'raw_query'].join(':'), JSON.stringify(query('/arts.js?' + ughSearch.join('&'))));
        }

        emitter.SADD_VALUE(['url', path, 'slug_'].join(':'), 'token:slug:id');
        emitter.SADD(['url', path, 'ips'].join(':'), ip);
        handled = true;
        numHandled++;
      }
      else if (parts.length === 3 && parts[1].match(/^[0-9]+$/) && !parts[2].match(/html$/)) {
        emitter.SADD_VALUE(['url', ['', parts[0], 'NNN', parts[2]].join('/'), 'slug_'].join(':'), 'token:slug:id');
        emitter.SET(['slug', slug, parts[0].replace(/s$/i, '')].join(':'), parts[1]);

        if (parts[0] === 'orders' || parts[0] === 'order') {
          emitter.SADD_VALUE(['order', parts[2], 'slug_'].join(':'), 'token:slug:id');
        }

        handled = true;
        numHandled++;
      }
      else if (parts[0] in pathRoots) {
        emitter.SADD_VALUE(['url', path, 'slug_'].join(':'), 'token:slug:id');
        handled = true;
        numHandled++;
      }
      else if (parts.length === 5 && parts[0] === 'promo_codes' && parts[1] === 'try_promo_code') {
        emitter.SADD_VALUE(['promo_code', parts[2], 'slug_'].join(':'), 'token:slug:id');
        emitter.SET(['slug', slug, 'promo_code'].join(':'), parts[3]);
        emitter.SADD(['promo_code', parts[2], 'ips'].join(':'), ip);
        handled = true;
        numHandled++;
      }
      else if (parts[0] === 'auth') {
        emitter.SADD_VALUE(['auth', [parts[1], parts[2]].join('/'), 'slug_'].join(':'), 'token:slug:id');
        emitter.SET(['slug', slug, 'auth'].join(':'), [parts[1], parts[2]].join('/'));
        handled = true;
        numHandled++;
      }
      else if (/\.php[^a-zA-Z0-9_]?/i.exec(path) || parts[0] in hackersRoots) {
        emitter.SADD_VALUE('url:/HACKERS:slug_', 'token:slug:id');
        emitter.SADD('url:/HACKERS:ips', ip);
        handled = true;
        numHandled++;
      }
      else if (/html\/?$/i.exec(path)) {
        emitter.SADD_VALUE('url:/HACKERS:slug_', 'token:slug:id');
        emitter.SADD('url:/HACKERS:ips', ip);
        emitter.SADD_VALUE('url:/HTMLFILE:slug_', 'token:slug:id');
        emitter.SADD('url:/HTMLFILE:ips', ip);
        handled = true;
        numHandled++;
      }
      else if (parts[0] in ignoreRoots) {
        // Nothing
        handled = true;
        numHandled++;
      }
          
      if (!handled) {
        console.error('--------------- dont know url: ', item[13], item[7]);
        emitter.SADD_VALUE('url:/HACKERS:slug_', 'token:slug:id');
        emitter.SADD('url:/HACKERS:ips', ip);
        emitter.SADD_VALUE('url:/UNKNOWN:slug_', 'token:slug:id');
        emitter.SADD('url:/UNKNOWN:ips', ip);
        //var m, cat = pathCategory(item[7]);
        //if (cat) {
        //  emitter.SADD(["url:%s1:slugs", cat.url], item[13]);
        //  if (cat.url === '/UNKNOWN') {
        //    console.error('--------------- dont know url: ', item[13], item[7]);
        //  }
        //}

        //if ((m = RegExp('^/generateTextLayer').exec(item[7]))) {
        //  url = urlLib.parse(item[7], true);
        //  //console.log(item[7]);
        //  if (url.query.art_id) {
        //    emitter.SADD(["gen_art_id:%s1:slugs", url.query.art_id], item[13]);
        //  }
        //}
      }
      //console.log('running item_end');
      emitter.RUN_SCRIPT('access_each', 1, 'token:slug:id', 'item_end', item[1], item[3]);
    };
  },

  // Categorize the referer [f11] (at least the easy ones)
  function(emitter) {
    return function(item, slug) {
      var m;

      if (item[11] === '-') {
        emitter.SADD_VALUE("referer:-:slug_", 'token:slug:id');
      }
      else if ((m = RegExp('^https?://[^/]*twosmiles\\.com(/?.*)$').exec(item[11]))) {
        var url = m[1],
            path = url.split('#', 1)[0].split('?', 1)[0],
            parts = _.rest(path.split('/'));

        var handled = false;
        if (parts[0] === 'projects' || parts[0] === 'project') {
          if (parts.length === 3) {
            if (parts[1].match(/[0-9a-fA-F-]+/) && parts[1].split('-').length === 5) {
              emitter.SADD_VALUE(['referer', ['', parts[0], 'GUID', parts[2]].join('/'), 'slug_'].join(':'), 'token:slug:id');
              emitter.SADD_VALUE(['guid', parts[1], 'slug_'].join(':'), 'token:slug:id');
              emitter.SET(['slug', slug, 'guid'].join(':'), parts[1]);
              handled = true;
            }
            else if (parts[1].match(/^[0-9]+$/)) {
              emitter.SADD_VALUE(['url', ['', parts[0], 'NNN', parts[2]].join('/'), 'slug_'].join(':'), 'token:slug:id');
              emitter.SET(['slug', slug, parts[0].replace(/s$/i, '')].join(':'), parts[1]);
              handled = true;
              numHandled++;
            }
          }
          else if (parts[0] in pathRoots) {
            emitter.SADD_VALUE(['referer', path, 'slug_'].join(':'), 'token:slug:id');
            handled = true;
          }
        }
        else if (parts.length === 1) {
          emitter.SADD_VALUE(['referer', path, 'slug_'].join(':'), 'token:slug:id');
          handled = true;
        }
        else if (parts.length === 3 && parts[1].match(/^[0-9]+$/) && !parts[2].match(/html$/)) {
          emitter.SADD_VALUE(['referer', ['', parts[0], 'NNN', parts[2]].join('/'), 'slug_'].join(':'), 'token:slug:id');
          emitter.SET(['slug', slug, parts[0].replace(/s$/i, '')].join(':'), parts[1]);

          if (parts[0] === 'orders' || parts[0] === 'order') {
            emitter.SADD_VALUE(['order', parts[2], 'slug_'].join(':'), 'token:slug:id');
          }

          handled = true;
        }
        else if (parts[0] in pathRoots) {
          emitter.SADD_VALUE(['referer', path, 'slug_'].join(':'), 'token:slug:id');
          handled = true;
        }
        else if (parts.length === 5 && parts[0] === 'promo_codes' && parts[1] === 'try_promo_code') {
          emitter.SADD_VALUE(['promo_code', parts[2], 'slug_'].join(':'), 'token:slug:id');
          emitter.SET(['slug', slug, 'promo_code'].join(':'), parts[3]);
          handled = true;
        }
        else if (parts[0] === 'auth') {
          emitter.SADD_VALUE(['auth', [parts[1], parts[2]].join('/'), 'slug_'].join(':'), 'token:slug:id');
          emitter.SET(['slug', slug, 'auth'].join(':'), [parts[1], parts[2]].join('/'));
          handled = true;
        }
        else if (parts.length === 0 || parts[0].length === 0) {
          emitter.SADD_VALUE(['referer', '/', 'slug_'].join(':'), 'token:slug:id');
          handled = true;
        }
        else if (/\.php[^a-zA-Z0-9_]?/i.exec(path) || parts[0] in hackersRoots) {
          emitter.SADD_VALUE('referer:/HACKERS:slug_', 'token:slug:id');
          handled = true;
        }
        else if (/html\/?$/i.exec(path)) {
          emitter.SADD_VALUE('referer:/HACKERS:slug_', 'token:slug:id');
          emitter.SADD_VALUE('referer:/HTMLFILE:slug_', 'token:slug:id');
          handled = true;
        }
        else if (parts[0] in ignoreRoots) {
          // Nothing
          handled = true;
        }
            
        if (!handled) {
          console.error('--------------- dont know ref: ', item[13], item[11]);
        }
      }
      else {
        if ((m = RegExp('^https?://([^/]+)$').exec(item[11]))) {
          if (m[1] === 'twosmiles.com') { console.log(item[11]); }
          emitter.SADD_VALUE("ext_referer:"+ m[1] +":slug_", 'token:slug:id');
        }
      }
    };
  }

];

var modelRe = RegExp('(/[^/]+)/([0-9]+)/([^/]+)$');
var modelPostRe = RegExp('(/[^/]+)/([^/]+)/([0-9]+)$');
var modelGuidRe = RegExp('(/[^/]+)/([0-9a-fA-F-]+)(/([^/]+))?$');


var pathCategory = function(path_) {

  var m;

  // Clean the path so it is not the search or hash
  var path = path_.split('?')[0].split('#')[0].split('&')[0];

  if (path.length === 0) { return; }

  // Hackers!!!!
  if (/\.php([^a-zA-Z]|$)/i.exec(path)) { return {url: '/HACKERS'}; }
  if (/^\/cgi/i.exec(path)) { return {url: '/HACKERS'}; }

  // /admin...
  if ((m = RegExp('^/admin').exec(path))) {
    return;
  }

  // -  or  /
  if (path === '-' || path === '/') {
    return {url: path};
  }
  
  // /assets...
  if ((m = RegExp('^(/(assets|video-js|support))/(.*)$').exec(path))) {
    return {url: m[1]};
  }

  // /api    /lib    /js
  if ((m = RegExp('^(/(api|lib|js))(/.*)$').exec(path))) {
    return {url: m[1]};
  }

  // /arts      or other singles
  if ((m = RegExp('^(/[^/]+)/?$').exec(path))) {
    return {url: m[1]};
  }

  // /one/two
  if ((m = RegExp('^(/[^/]+)(/[^/]+)/??$').exec(path))) {
    return {url: m[1] + m[2]};
  }

  // /model/ID/method
  if (( m = modelRe.exec(path))) {
    return {url: printf("%s1/NNN/%s2", m[1], m[3])};
  }

  // /model/verb/index     /cart/delete/1
  if (( m = modelPostRe.exec(path))) {
    return {url: printf("%s1/%s2/NNN", m[1], m[3])};
  }

  // /model/GUID/method
  if (( m = modelGuidRe.exec(path)) && m[2].length === 36) {
    return {url: printf("%s1/GUID/%s2", m[1], m[4])};
  }

  // /projects/GUID/blah/blah/somethingorother.class
  if ((m = RegExp('^/projects/([0-9a-fA-F-]+)/(.*\\.class)$').exec(path))) {
    return {url: "/project/GUID/" + m[2]};
  }

  // /auth/facebook/callback
  if ((m = RegExp('^/auth(/[^/]+)/').exec(path))) {
    return {url: '/auth' + m[1]};
  }

  // /arts/preview_
  if ((m = RegExp('^/arts/preview_').exec(path))) {
    return {url: '/arts/preview_'};
  }

  // /promo_codes
  if ((m = RegExp('^/promo_codes(/try_promo_code/.*)$').exec(path))) {
    return {url: m[1]};
  }

  // /smile_content
  if ((m = RegExp('^(/smile_content)').exec(path))) {
    return {url: m[1]};
  }

  // I dont know this category
  //console.error('--------------- dont know: ', path_.length, path_);
  return {url: '/UNKNOWN'};
};

