

exports.registerFilters = function(register, sg, callback) {

  var _         = sg._;

  register({
    http_stat:  {set:true},
    server:     {enum:true},
    method:     {enum:true},
    speed:      {set:true},
    size:       {set:true},
    month:      {set:true},
    day:        {set:true},
    hour:       {set:true},
    minute:     {set:true},
    ua:         {enum:true},
    uaa:        {enum:true}
  }, 
  
  // Categorize the stats (all the numeric fields)
  function(emitter, params) {
    var http_stat = params.emitters.http_stat  || emitter,
      server      = params.emitters.server  || emitter,
      method      = params.emitters.method  || emitter,
      speed       = params.emitters.speed  || emitter,
      size        = params.emitters.size   || emitter,
      month       = params.emitters.month  || emitter,
      day         = params.emitters.day  || emitter,
      hour        = params.emitters.hour  || emitter,
      minute      = params.emitters.minute  || emitter,
      ua          = params.emitters.ua  || emitter,
      uaa         = params.emitters.uaa  || emitter;

    return function(item, slug) {
      http_stat.SADD(["http_stat:%s1:slugs", item[9]], item[13]);
      server.SADD(["server:%s1:slugs", item[2]], item[13]);
      method.SADD(["method:%s1:slugs", item[6]], item[13]);

      speed.SADD(["speed:%s1:slugs", sg.log2Floor(item[4])], item[13]);
      size.SADD(["size:%s1:slugs", sg.log2Floor(item[10])], item[13]);

      // Time
      var time = item[1].replace(/:/g, '/').split('/');
      month.SADD(["month:%s1:slugs", _.first(time, 2).join('/')], item[13]);
      day.SADD(["day:%s1:slugs", _.first(time, 3).join('/')], item[13]);
      hour.SADD(["hour:%s1:slugs", _.first(time, 4).join('/')], item[13]);
      minute.SADD(["minute:%s1:slugs", _.first(time, 5).join('/')], item[13]);

      // User Agent
      var m;
      if ((m = /^([^~]+)~\((.+)\)$/.exec(item[12]))) {
        ua.SADD(["ua:%s1:slugs", m[1]], item[13]);
        _.each(m[2].replace(/~*;~*/g, ';').split(';'), function(uaAttr) {
          uaa.SADD(["uaa:%s1:slugs", uaAttr], item[13]);
        });

      }
    };
  });

  return callback();
};


