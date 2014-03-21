
-- Apache access log file processing - at least most of it.
--    We do not process the url, referer, or other trivial items like HTTP protocol version
--
-- Given the "combined" log file (with client IP), you should use 'cut' to remove the fields
-- that this utility doesn't want:
--
--      ... | cut -d' ' -f1,2,3,4,6,9,10 | ...
--

local function sadd(prefix, obj, type_, value)
  redis.call('SADD', prefix..':'..obj..':'..type_..'_', value)
end

local function set(prefix, obj, type_, value)
  redis.call('SET', prefix..':'..obj..':'..type_, value)
end

-- Each line of the log file has several fields.  Each field-value
-- has a set, and the slug is SADDed.  Then the slug has the field-value
-- SET.
local function sadd_slug(prefix, obj, value)                  -- ip,  15.80.125.1,  42

  -- See if this object already has an id
  local id = 0
  if redis.call('EXISTS', prefix..':'..obj..':id') == 1 then
    id = redis.call('GET', prefix..':'..obj..':id')
  else
    -- No? Get a new one
    id = redis.call('INCR', 'token:'..prefix..':id')         -- INCR token:ip:id   <42>
    redis.call('SET', prefix..':'..obj..':id', id)
  end
  set(prefix..'_id', id, prefix, obj)                        -- SET  ip_id:42:ip            15.80.125.1
  sadd(prefix..'_id', id, 'slug', value)                     -- SADD ip_id:42:slug          925
  sadd(prefix, obj, 'slug', value)                           -- SADD ip:15.80.125.1:slug    925
  return set('slug', value, prefix..'_id', id)               -- SET  slug:925:ip_id         42
end

-- A simplified version of sadd_slug, that sets the value and skips id-ifying the object
local function sadd_slug_lite(prefix, obj, value)            -- ip,  15.80.125.1,  42
  sadd(prefix, obj, 'slug', value)                           -- SADD ip:42:slug    925
  return set('slug', value, prefix, obj)                     -- SET  slug:925:ip   42
end

-- main
local log2inv = 1/math.log(2)
local slug = redis.call('INCR', KEYS[1])
local minute = string.match(ARGV[1], '(..../../../../..).*$')

--sadd_slug('second', ARGV[1], slug)
sadd_slug('minute', minute, slug)
set('slug', slug, 'second', ARGV[1])

--redis.call('SET', 'slug:'..slug..':file_slug', ARGV[8])
--redis.call('SET', 'file_slug:'..ARGV[8]..':slug', slug)

sadd_slug('hour', string.match(ARGV[1], '(..../../../..).*$'), slug)
--sadd_slug('day', string.match(ARGV[1], '(..../../..).*$'), slug)
--sadd_slug('month', string.match(ARGV[1], '(..../..).*$'), slug)
--sadd_slug('server', ARGV[2], slug)
sadd_slug('ip', ARGV[3], slug)
set('slug', slug, 'ip', ARGV[3])

sadd_slug_lite('size', math.log(ARGV[7]) * log2inv, slug)
sadd_slug_lite('elapsed', math.log(ARGV[4]) * log2inv, slug)
sadd_slug_lite('method', ARGV[5], slug)
sadd_slug_lite('http_code', ARGV[6], slug)


