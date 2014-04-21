
/**
 *
 */

var urlLib = require('url');

exports.init = function(context, callback) {

  var _ = context._;

  //context.enumType = 'serialize';
  context.enumType = 'bulk';

  var bulkTypes = [
    /* 1: */ {name:'time', ty:'time'},
    /* 2: */ {name:'server', ty:'lite_enum'},
    /* 3: */ {name:'ip', ty:'ip_addr'},
    /* 4: */ {name:'elapsed', ty:'ln'},
    /* 5: */ {},
    /* 6: */ {name:'method', ty:'lite_enum'},
    /* 7: */ {name:'url', ty:'string'},
    /* 8: */ {name:'http_ver', ty:'lite_enum'},
    /* 9: */ {name:'resp_code', ty:'nenum'},
    /* 10: */ {name:'size', ty:'ln'},
    /* 11: */ {name:'referer', ty:'string'},
    /* 12: */ {name:'user_agent', ty:'string'},

    /* 13: */ {name:'unknown', ty:'string'},
    /* 14: */ {name:'model', ty:'lite_enum'},
    /* 15: */ {name:'action', ty:'lite_enum'},
    /* 16: */ {name:'obj_id', ty:'db_id'},
    /* 17: */ {name:'obj_guid', ty:'guid'},
    /* 18: */ {name:'pathname', ty:'lite_enum'},
    /* 19: */ {name:'page', ty:'lite_enum'}
  ];

  var serializeTypes = [
    /* 1: */ {name:'time', ty:'time'},
    /* 2: */ {},   /*'server:lite_enum',*/
    /* 3: */ {name:'ip', ty:'ip_addr'},
    /* 4: */ {}, /*'elapsed:ln',*/
    /* 5: */ {},
    /* 6: */ {name:'method', ty:'lite_enum'},
    /* 7: */ {}, /*'url:string',*/
    /* 8: */ {}, /*'http_ver:lite_enum',*/
    /* 9: */ {name:'resp_code', ty:'nenum'},
    /* 10: */ {}, /*'size:ln',*/
    /* 11: */ {}, /*'referer:string',*/
    /* 12: */ {}, /*'user_agent:string',*/

    /* 13: */ {name:'unknown', ty:'string'},
    /* 14: */ {name:'model', ty:'lite_enum'},
    /* 15: */ {name:'action', ty:'lite_enum'},
    /* 16: */ {name:'obj_id', ty:'db_id'},
    /* 17: */ {name:'obj_guid', ty:'guid'},
    /* 18: */ {name:'pathname', ty:'lite_enum'},
    /* 19: */ {name:'page', ty:'lite_enum'}
  ];

  context.typeName = 'access';

  if (context.enumType === 'bulk') {
    context.types = bulkTypes;
  } else {
    context.types = serializeTypes;
  }

  var pageNames = {
    '/'           : true,
    '/arts'       : true,
    '/merchants'  : true
  };

  var modelNames_wId = {
    merchants   : true,
    orders      : true,
    arts        : true
  };

  var modelNames_wGuid = {
    orders      : true,
    projects    : true
  };

  var modelNames = _.extend({}, modelNames_wId, modelNames_wGuid);

  context.split = function(line) {
    var ret = line.split(/[ \t]/);
    if (ret.length > 12) { return 'ENOPARSE'; }
    if (ret.length < 11) {
      if (ret.length === 10 && /\d+/.exec(ret[3]) && /\d\d\d/.exec(ret[6]) && /\d+/.exec(ret[7])) {
        ret.splice(5, 0, '-', '-');
      } else {
        return 'ENOPARSE';
      }
    }

    if (!/mozilla/i.exec(ret[11])) {
      return null;
    }

    ret.unshift(line);

    ret.raw = ret.slice();
    ret.raw[0] = '-';
    ret.time = ret[1].split(/[^0-9]/);

    ret[2] = '-';
    ret[8] = '-';
    ret[12] = '-';

    if (context.enumType !== 'bulk') {
      ret[7] = '-';
      ret[11] = '-';
    }

    return ret;
  };

  var g_fields;
  var parseUrl = function(pathname, url, parts) {
    url = url || urlLib.parse(pathname, true);
    if (url.pathname) {
      if (!parts) {
        parts = url.pathname.split('/');
        parts.shift();
      }
    } else {
      console.log('error parsing url: ' + pathname);
      console.log(g_fields);
    }

    return {url:url, parts:parts};
  };

  context.processFields = function(fields, options, callback) {
    g_fields = fields;

    fields[13] = fields[14] = fields[15] = fields[16] = fields[17] = fields[18] = fields[19] = '-';

    var pathname = fields.raw[7];
    var url, parts, urlUnderstood = false;
    //console.log(pathname);

    if (/^\/generatetextlayer/i.exec(pathname)) {
      return callback(null, null);
    }

    if (!options.skip.pathname) {
      url   = url   || parseUrl(pathname, url, parts).url;
      fields[18] = url.pathname;
    }

    if (!options.skip.model) {
      url   = url   || parseUrl(pathname, url, parts).url;
      parts = parts || parseUrl(pathname, url, parts).parts;

      if (modelNames[parts[0]]) {
        fields[14] = parts[0];
        urlUnderstood = true;
      } 
    }

    if (!options.skip.page) {
      url   = url   || parseUrl(pathname, url, parts).url;
      parts = parts || parseUrl(pathname, url, parts).parts;

      if (pageNames['/'+parts[0]]) {
        fields[19] = parts[0];
        urlUnderstood = true;
      } 
    }

    if (!options.skip.action) {
      url   = url   || parseUrl(pathname, url, parts).url;
      parts = parts || parseUrl(pathname, url, parts).parts;

      if (modelNames[parts[0]]) {
        if (parts.length === 2) {
          fields[15] = parts[1];
        } else if (parts.length > 2) {
          fields[15] = parts[2];
        }
      }
    }

    if (!options.skip.model_id) {
      url   = url   || parseUrl(pathname, url, parts).url;
      parts = parts || parseUrl(pathname, url, parts).parts;

      if (parts.length > 2 && modelNames_wId[parts[0]]) {
        fields[16] = parts[1];
      }
    }

    if (!options.skip.model_guid) {
      url   = url   || parseUrl(pathname, url, parts).url;
      parts = parts || parseUrl(pathname, url, parts).parts;

      if (parts.length > 2 && modelNames_wGuid[parts[0]]) {
        fields[17] = parts[1];
      }
    }

    if (!options.skip.unknown) {
      url   = url   || parseUrl(pathname, url, parts).url;

      if (!urlUnderstood && context.enumType === 'bulk') {
        fields[13] = url.pathname;
      }
    }

    return callback(null, fields);
  };

  context.on('closeSecond', function(a, b, callback) {
    //if (context.enumType === 'bulk') { return callback(a, b); }
    context.closeSecond(a, b);

    return callback(a, b);
  });

  context.on('closeMinute', function(a, b, callback) {
    //if (context.enumType === 'bulk') { return callback(a, b); }
    context.closeMinute(a, b);

    return callback(a, b);
  });

  context.on('closeDay', function(a, b, callback) {
    //if (context.enumType === 'bulk') { return callback(a, b); }
    context.closeDay(a, b);

    return callback(a, b);
  });

  return callback();
};

