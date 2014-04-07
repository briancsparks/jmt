
local curr_slug, curr_slug_time, curr_slug_date, curr_slug_second, curr_slug_n_second
local y, mo, d, h, m, s

local log2inv = 1/math.log(2)

local function log(message)
  redis.call('RPUSH', 'debug', message)
end

local function key(type_, id, attr_name)
  return type_..':'..id..':'..attr_name
end

local function skey(a, b)
  return key(a, b, typename..'_slug_')
end

local function skey2(a, b, c)
  return key(a, b, typename..'_'..c..'_slug_')
end

local function slugkey(slug, c)
  return key(typename..'_slug', slug, c)
end

local function slugkey2(slug, c)
  return skey2(typename..'_slug', slug, c)
end

local function keys(query)
  return redis.call('KEYS', query)
end

local function set(type_, id, attr_name, value)
  return redis.call('SET', key(type_, id, attr_name), value)
end

local function get(a, b, c)
  return redis.call('GET', key(a, b, c))
end

local function incr(type_, id, attr_name)
  return redis.call('INCR', key(type_, id, attr_name))
end

local function sadd(type_, id, attr_name, value)
  return redis.call('SADD', key(type_, id, attr_name), value)
end

local function smembers(a, b, c)
  return redis.call('SMEMBERS', key(a, b, c))
end

local function sunionstore(a, b, c, ...)
  return redis.call('SUNIONSTORE', key(a, b, c), unpack(arg))
end

local function sunionaccum(a, b, c, ...)
  return redis.call('SUNIONSTORE', key(a, b, c), key(a, b, c), unpack(arg))
end

local function spromote(other, target)
  redis.call('SUNIONSTORE', target, target, other)
  redis.call('DEL', other)
end

local function exists(type_, id, attr_name)
  return redis.call('EXISTS', key(type_, id, attr_name))
end

local function del(a, b, c)
  return redis.call('DEL', key(a, b, c))
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

local function smembers_plus1(group, type_, type2)
  local members = redis.call('SMEMBERS', group)
  table.sort(members)
  local other = convert_to(type_, members, type2)
  return members, other
end

local function slugmembers_plus1(group, type1)
  return smembers_plus1(group, typename..'_slug', type1)
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

local function get_id(name, value)
  -- See if this object already has an id
  local id = 0
  if exists(name, value, 'id') == 1 then
    return get(name, value, 'id')
  end

  -- No? Get a new one
  id = incr('token', name, 'id')
  set(name, value, 'id', id)
  -- Shouldnt there also be a set(name..'_id', id, name, value)
  return id
end

local function future_minute(count, y, mo, d, h, m)
  m = m + count
  --if m > 59 then
  while m > 59 do 
    h = h + 1
    m = m - 60
  end

  if h > 23 then
    d = d + 1
    h = h - 24
  end

  -- TODO handle leap-year
  if d > 28 and mo == 2 then
    mo = mo + 1
    d = 1
  elseif d > 30 and (mo == 4 or mo == 6 or mo == 9 or mo == 11) then
    mo = mo + 1
    d = 1
  elseif d > 31 then
    mo = mo + 1
    d = 1
  end

  if mo > 12 then
    y = y + 1
    mo = 1
  end

  return string.format('%04d/%02d/%02d/%02d/%02d', y, mo, d, h, m)
end

-- TODO: Remove this
local abort_commit = 0

local curr_slug_expiration = 0
local function __commit_slug2()
  redis.call('SET', typename..'_slug:'..curr_slug..':time', curr_slug_time)
  redis.call('SET', typename..'_slug:'..curr_slug..':date', curr_slug_date)
  redis.call('SET', typename..'_slug:'..curr_slug..':second', curr_slug_second)
  redis.call('SET', typename..'_slug:'..curr_slug..':n_second', curr_slug_n_second)

  --redis.log(redis.LOG_NOTICE, curr_slug_expiration)
  if curr_slug_expiration == 0 then
    --curr_slug_expiration = future_minute(18, y, mo, d, h, m)
    curr_slug_expiration = future_minute(180, y, mo, d, h, m)
  end

  redis.call('SADD', typename..'_delete_at:'..curr_slug_expiration..':slug', curr_slug)
  local res = redis.call('SET', typename..'_slug:'..curr_slug..':expiration', curr_slug_expiration)
end

local function _openSecond(s)
end

--local s_current_second  = skey('current_second', typename)
--local s_current_minute  = skey('current_minute', typename)

local function _closeSecond(s_, prev_s)
  --local s = string.match(s_, '(%d%d)$')
  --redis.call('RENAME', s_current_second, 'second:'..s..':'..typename..'_slug_')
end

local function _openMinute()
end

local delete_delayed_key = typename..'_delete_delayed:slug'

local function __handle_delete_delayed(force)
  local _, key, count

  --redis.log(redis.LOG_NOTICE, 'hdd: '..force..' '..redis.call('SCARD', delete_delayed_key))

  local temp_keys = {}
  if redis.call('EXISTS', delete_delayed_key) == 1 then
    if force == 1 or redis.call('SCARD', delete_delayed_key) > 3000 then
      for _, key in pairs(redis.call('SMEMBERS', delete_delayed_key)) do
        local count = redis.call('SDIFFSTORE', key, key, delete_delayed_key)
        if count == 0 then
          table.insert(temp_keys, key)
        end
        
        if #temp_keys > 200 then
          redis.call('DEL', unpack(temp_keys))
          temp_keys = {}
        end
      end

      if #temp_keys > 0 then
        redis.call('DEL', unpack(temp_keys))
      end

      redis.call('DEL', delete_delayed_key)
    end
  end
end

local function __handle_delete_at_key(delete_at_key)
  local _, key, count

  local temp_keys = {}
  for _, key in pairs(redis.call('SMEMBERS', delete_at_key)) do
    __delete_slug(key)
    table.insert(temp_keys, key)
    if #temp_keys > 200 then
      redis.call('SADD', delete_delayed_key, unpack(temp_keys))
      temp_keys = {}
    end
  end

  if #temp_keys > 0 then
    redis.call('SADD', delete_delayed_key, unpack(temp_keys))
  end

  redis.call('DEL', delete_at_key)

  __handle_delete_delayed(0)
end

local function _closeMinute(m_, prev_m)

  redis.log(redis.LOG_NOTICE, 'Closing minute: '..prev_m)
  --_promote_current_seconds()

  if enum_type == 'serialize' then
    __handle_delete_at_key(typename..'_delete_at:'..prev_m..':slug')
  end
end

local function _openHour()
end

local function _closeHour(h, prev_h)

  redis.log(redis.LOG_NOTICE, 'Closing hour: ------- '..prev_h)

  if enum_type == 'serialize' then
    __handle_delete_at_key(typename..'_delete_at:'..prev_h..':slug')
  end
  
end

local function _closeDay(d, prev_d)
  redis.call('SADD', key(typename, 'close_day', 'date'), prev_d)

  redis.log(redis.LOG_NOTICE, 'Closing day: -------- '..prev_d)

  if enum_type == 'serialize' then
    __handle_delete_at_key(typename..'_delete_at:'..prev_d..':slug')
    __handle_delete_delayed(1)
  end
end

local function _closeAll()
  __handle_delete_delayed(1)
end

-- user content here

