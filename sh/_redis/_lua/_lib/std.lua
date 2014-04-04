
local log2inv = 1/math.log(2)

local function log(message)
  redis.call('RPUSH', 'debug', message)
end

local function register_key(collection_type, prefix, type_)
  redis.call('SADD', 'keyspace:'..collection_type..':keys', prefix)
  redis.call('SADD', 'keyspace:'..prefix..':r_type', collection_type)
  redis.call('SADD', 'keyspace:'..prefix..':types', type_)
end

local function key_ex(r_type, prefix, obj, type_)
  register_key(r_type, prefix, type_)
  local k = prefix..':'..obj..':'..type_
  return k
end

local function sadd_ex(prefix, obj, type_, value)
  local k = key_ex('set', prefix, obj, type_)
  redis.call('SADD', k, value)
end

local function set_ex(prefix, obj, type_, value)
  local k = key_ex('string', prefix, obj, type_)
  redis.call('SET', k, value)
end

-- Convienence
local function key(type_, id, attr_name)
  return type_..':'..id..':'..attr_name
end

local function keys(query)
  return redis.call('KEYS', query)
end

local function set(type_, id, attr_name, value)
  return redis.call('SET', key(type_, id, attr_name), value)
end

local function get(type_, id, attr_name)
  return redis.call('GET', key(type_, id, attr_name))
end

local function incr(type_, id, attr_name)
  return redis.call('INCR', key(type_, id, attr_name))
end

local function sadd(type_, id, attr_name, value)
  return redis.call('SADD', key(type_, id, attr_name), value)
end

local function exists(type_, id, attr_name)
  return redis.call('EXISTS', key(type_, id, attr_name))
end

-- Each line of the log file has several fields.  Each field-value
-- has a set, and the slug is SADDed.  Then the slug has the field-value
-- SET.
-- Generally, the value in each of these fields belongs to a set.  Also,
-- Redis is much faster if it does the set manipulation functions on
-- integers than if it does them on strings.  So, we lookup the obj
-- to find an ID for it, or we create a new one.
local function sadd_slug(type_, value, slug_value)            -- ip,  15.80.125.1,  925

  -- See if this object already has an id
  local id = 0
  if exists(type_, value, 'id') == 1 then
    id = get(type_, value, 'id')
  else
    -- No? Get a new one
    id = incr('token', type_, 'id')                           -- INCR token:ip:id   <42>
    set(type_, value, 'id', id)
  end

  set_ex(type_..'_id', id, type_, value)                      -- SET  ip_id:42:ip            15.80.125.1
  sadd_ex(type_..'_id', id, 'slug_', slug_value)              -- SADD ip_id:42:slug          925
  sadd_ex(type_, value, 'slug_', slug_value)                  -- SADD ip:15.80.125.1:slug    925
  return set_ex('slug', slug_value, type_..'_id', id)         -- SET  slug:925:ip_id         42
end

-- If the item is an enum (small, closed set of values, like the HTTP method -- POST, GET, etc)
--   It doesnt need to be id-ified
local function sadd_slug_enum(type_, value, slug_value)       -- method,  post,             926
  sadd_ex(type_, value, 'slug_', slug_value)                  -- SADD     method:post:slug  926
  return set_ex('slug', slug_value, type_, value)             -- SET      slug:926:method   post
end

-- If the item is numeric
local function sadd_slug_quantity(type_, value, slug_value)                       -- size, 78348634,        927
  sadd_ex('log2_'..type_, math.floor(math.log(value) * log2inv), 'slug_', slug_value)          -- SADD log_size:12:slug_ 927
  return set_ex('slug', slug_value, type_, value)                                 -- SET  slug:927:size     78348634
end

-- If the item is numeric, and you also have a string version to add
local function sadd_slug_and_numeric(type_, value, str_value, slug_value)    -- second, 59, 00/00/59, 928
  sadd_ex(type_, str_value, 'slug_', slug_value)              -- SADD second:00/00/59:slug_ 928
  set_ex('slug', slug_value, type_, str_value)                -- SADD slug:928:second 00/00/59
  sadd_ex('n_'..type_, value, 'slug_', slug_value)            -- SADD n_second:59:slug_ 928
  return set_ex('slug', slug_value, 'n_'..type_, value)       -- SADD slug:928:n_second 59
end

-- A simplified version of sadd_slug, that sets the value and skips id-ifying the object
local function sadd_slug_lite(type_, value, slug_value)       -- ip,  15.80.125.1,  925
  sadd_ex(type_, value, 'slug_', slug_value)                  -- SADD ip:15.80.125.1:slug    925
  return set_ex('slug', slug_value, type_, value)             -- SET  slug:925:ip   15.80.125.1
end

local function del_star(key_glob)
  local keys = redis.call('KEYS', key_glob)
  if #keys > 0 then
    redis.call('DEL', unpack(keys))
  end
end

local function generate_seconds(year, month, value, num_days)
  for _day = 1, num_days do
    local day = _day
    if day < 10 then
      day = string.format('%02d', _day)
    end

    for _hour = 0, 23 do
      local hour = _hour
      if hour < 10 then
        hour = string.format('%02d', _hour)
      end

      for _minute = 0, 59 do
        local minute = _minute
        if minute < 10 then
          minute = string.format('%02d', _minute)
        end

        for _second = 0, 59 do
          local second = _second
          if second < 10 then
            second = string.format('%02d', _second)
          end

          redis.call('SET', 'second:'..year..'/'..month..'/'..day..'/'..hour..'/'..minute..'/'..second..':second', value)
          value = value + 1
        end
      end
    end
  end
end

local function generate_seconds_of_day()
  local second_value = 0
  local minute_value = 0

  for _hour = 0, 23 do
    local hour = _hour
    if hour < 10 then
      hour = string.format('%02d', _hour)
    end

    for _minute = 0, 59 do
      local minute = _minute
      if minute < 10 then
        minute = string.format('%02d', _minute)
      end

      redis.call('SET', 'minute:'..hour..'/'..minute..':minute_of_day', minute_value)
      minute_value = minute_value + 1

      for _second = 0, 59 do
        local second = _second
        if second < 10 then
          second = string.format('%02d', _second)
        end

        redis.call('SET', 'second:'..hour..'/'..minute..'/'..second..':second_of_day', second_value)
        second_value = second_value + 1
      end
    end
  end
end

local function convert_keys_to(prefix, members, suffix)
  local ret = {}
  for i, member in pairs(members) do
    ret[i] = prefix..':'..member..':'..suffix
  end
  return ret
end

local function convert_to(prefix, members, suffix)
  local keys2 = convert_keys_to(prefix, members, suffix)
  if #keys2 == 0 then
    return {}
  end

  local ret = {}
  if #keys2 > 200 then
    for i, k in pairs(keys2) do
      ret[i] = k
    end
  else
    ret = redis.call('MGET', unpack(keys2))
  end

  return ret
end

local function sintersort_plus1(type_, type2, ...)
  local intersection = redis.call('SINTER', unpack(arg))
  table.sort(intersection)
  local other = convert_to(type_, intersection, type2)
  return intersection, other
end

local function sadd_temp(verb, prefix, id, suffix, value)
  local key = prefix..':'..id..':'..suffix
  redis.call('SADD', prefix..'_keys', key)
  redis.call(verb, key, value)
end

local function sadd_temp2(verb, key_name, prefix, id, suffix, value)
  local key = prefix..':'..id..':'..suffix
  redis.call('SADD', key_name..'_keys', key)
  redis.call(verb, key, value)
end

local function clean_temp_keys(prefix)
  local ret = redis.call('SCARD', prefix..'_keys')
  if ret > 0 then
    redis.call('DEL', unpack(redis.call('SMEMBERS', prefix..'_keys')))
  end
  redis.call('DEL', prefix..'_keys')
  return ret
end

-- Stack functions

local function fl_keyify(flid, which)
  return 'ns:jmt_fl:stack:'..flid..':'..which
end

local function fl_item(flid, num)
  return fl_keyify(flid, 'item:'..num..':value')
end

local function fl_top(flid)
  local top = 0
  if redis.call('EXISTS', fl_keyify(flid, 'top')) == 0 then
    redis.call('SET', fl_keyify(flid, 'top'), top)
  else
    top = redis.call('GET', fl_keyify(flid, 'top'))
  end
  return fl_item(flid, top)
end

local function fl_SINTER(flid, keys)
  redis.call('SINTERSTORE', fl_top(flid), #keys, unpack(keys))
end

local function slice (values,i1,i2)
  local res = {}
  local n = #values
  -- default values for range
  i1 = i1 or 1
  i2 = i2 or n
  if i2 < 0 then
    i2 = n + i2 + 1
  elseif i2 > n then
    i2 = n
  end
  if i1 < 1 or i1 > n then
    return {}
  end
  local k = 1
  for i = i1,i2 do
    res[k] = values[i]
    k = k + 1
  end
  return res
end

