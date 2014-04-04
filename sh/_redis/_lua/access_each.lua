
-- Apache access log file processing - at least most of it.
--    We do not process the url, referer, or other trivial items like HTTP protocol version
--
-- Given the "combined" log file (with client IP), you should use 'cut' to remove the fields
-- that this utility doesn't want:
--
--      ... | cut -d' ' -f1,2,3,4,6,9,10 | ...
--

-- main
local function item_start(time_stamp, server, ip, elapsed, method, http_code, size, file_slug)
  local slug = redis.call('INCR', KEYS[1])
  set('slug', slug, 'locator', time_stamp..'~'..ip..'~'..elapsed)
  local minute = string.match(time_stamp, '(..../../../../..).*$')

  --sadd_slug('ssecond', time_stamp, slug)
  --sadd_slug('minute', minute, slug)
  --set('slug', slug, 'second', time_stamp)

  local sod = string.match(time_stamp, '..../../(../../..)$')
  local second_of_day = redis.call('GET', 'second:'..sod..':second_of_day')
  sadd_slug_and_numeric('second', second_of_day, time_stamp, slug)
  --set('slug', slug, 'second_of_day', second_of_day)
  --sadd_slug_lite('second', second_of_day, slug)

  local mod = string.match(time_stamp, '..../../(../..)/..$')
  local minute_of_day = redis.call('GET', 'minute:'..mod..':minute_of_day')
  sadd_slug_and_numeric('minute', minute_of_day, minute, slug)
  --set('slug', slug, 'minute_of_day', minute_of_day)
  --sadd_slug_lite('minute', minute_of_day, slug)

  --redis.call('SET', 'slug:'..slug..':file_slug', file_slug)
  --redis.call('SET', 'file_slug:'..file_slug..':slug', slug)

  sadd_slug('hour', string.match(time_stamp, '(..../../../..).*$'), slug)
  sadd_slug('day', string.match(time_stamp, '(..../../..).*$'), slug)
  --sadd_slug('month', string.match(time_stamp, '(..../..).*$'), slug)
  --sadd_slug('server', server, slug)
  sadd_slug('ip', ip, slug)
  set('slug', slug, 'ip', ip)

  sadd_slug_quantity('size', size, slug)
  sadd_slug_quantity('elapsed', elapsed, slug)
  sadd_slug_enum('method', method, slug)
  sadd_slug_enum('http_code', http_code, slug)
end

local function item_end(_X, time_stamp, ip_)

  local slug_ = redis.call('GET', KEYS[1])
  local url = redis.call('GET', 'slug:'..slug_..':url')
  local ip_id = redis.call('GET', 'ip:'..ip_..':id')

  local slug = 'slug:'..slug_
  local ip   = 'ip_id:'..ip_id

  redis.call('ZINCRBY', 'slug_url', 1, url)
  if url == '/' or url == '/arts' or url == '/marchants' then
    redis.call('INCRBY', ip..':usage_score', 1)
    redis.call('SETNX', ip..':onramp_slug', slug_)
    redis.call('DEL', ip..':pp_slug')
  end

  if url == '/projects' then
    redis.call('INCRBY', ip..':usage_score', 1)
    local method = redis.call('GET', slug..':method')
    if method == 'post' then

      if redis.call('EXISTS', ip..':onramp_slug') == 1 then
        local onramp_slug_ = redis.call('GET', ip..':onramp_slug')
        local onramp_slug = 'slug:'..onramp_slug_

        local start = redis.call('GET', onramp_slug..':n_second')
        local stop = redis.call('GET', slug..':n_second')


        redis.call('SET', slug..':onramp_slug', onramp_slug_)
        redis.call('SADD', 'has:onramp_slug:slug_', slug_)
        if stop > start then
          redis.call('SET', slug..':speed_to_pp', stop - start)
          redis.call('SADD', 'has:speed_to_pp:slug_', slug_)
        else
          redis.call('SET', slug..':speed_to_pp', stop - start)
          redis.call('SADD', 'has:negative_speed_to_pp:slug_', slug_)
        end
        redis.call('DEL', ip..':onramp_slug')
      elseif redis.call('EXISTS', ip..':pp_slug') == 1 then
        local pp_slug_ = redis.call('GET', ip..':pp_slug')
        local pp_slug = 'slug:'..pp_slug_

        redis.call('RPUSH', pp_slug..':subsequent_pprojects', slug_)
        redis.call('SADD', 'has:subsequent_pprojects:slug_', pp_slug_)
      else
        redis.call('SADD', 'missed:project_assoc:slug_', slug_)
      end

      redis.call('SETNX', ip..':pp_slug', slug_)
    end
  end
end

if ARGV[1] == 'item_start' then
  return item_start(unpack(slice(ARGV, 2)))
end

if ARGV[1] == 'item_end' then
  return item_end(unpack(ARGV))
end

return 0

