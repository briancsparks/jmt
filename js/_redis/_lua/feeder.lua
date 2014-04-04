
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

local function curr_slug()
  return get('token', typename..'_slug', 'id')
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
  return id
end

local function set_field_name(n, name)
  redis.call('SADD', key(typename, 'field', 'names'), name)
  redis.call('SADD', key(typename, 'field', 'have_name'), n)
  return redis.call('SET', key(typename, 'f'..n, 'name'), name)
end

local function set_field_type(n, type_)
  redis.call('SADD', key(typename, 'field', 'types'), type_)
  redis.call('SADD', key(typename, 'field', 'have_type'), n)
  return redis.call('SET', key(typename, 'f'..n, 'type'), type_)
end

local function field_name(n)
  return redis.call('GET', key(typename, 'f'..n, 'name'))
end

local function field_type(n)
  return redis.call('GET', key(typename, 'f'..n, 'type'))
end

local function set_f(n, value)
  redis.call('SADD', key('current_slug', typename, 'present_fields'), n)
  return redis.call('SET', key('current_slug', typename, 'f'..n), value)
end

local function f(n)
  return redis.call('GET', key('current_slug', typename, 'f'..n))
end

local function _init(...)
  del('current_second', typename, typename..'_slug_')
  del('current_minute', typename, typename..'_slug_')

  local name, type_, _, spec
  for n = 1, #arg do
    spec = arg[n]
    if spec ~= '-' then
      _, _, name, type_ = string.find(spec, '(.+):(.+)')

      set_field_name(n, name)
      set_field_type(n, type_)

      sadd('keyspace', 'slug_suffix', typename, name..'_id')
      sadd('keyspace', 'slug_suffix', typename, name)

      sadd(typename..'_type_holder', 'slug', 'name', name)
      --if type_ ~= 'ln' then
        sadd(typename..'_type_holder', 'slug', 'name', name..'_id')
      --end
    end
  end

  redis.call('SADD', key(typename, 'field', 'names'), 'date')
  redis.call('SADD', key(typename, 'field', 'names'), 'expiration')
  redis.call('SADD', key(typename, 'field', 'names'), 'n_second')
  redis.call('SADD', key(typename, 'field', 'names'), 'second')
end


local function add_slug(name, value, id)
  local slug = curr_slug()

  -- Convert between numeric values of slugs and other things
  sadd(name..'_id', id, typename..'_slug_', slug)             -- ip_id:55:access_slug_          -> 42
  set(typename..'_slug', slug, name..'_id', id)               -- access_slug:42:ip_id           -> 55

  -- Remember that the ip_id:X is storing the slug
  sadd(typename..'_type_holder', 'slug', name..'_id', id)     -- access_type_holder:slug:ip_id  -> 55

  -- Translate between natural and numeric
  set(name, value, name..'_id', id)                           -- ip:15.80.125.22:ip_id          -> 55
  set(name..'_id', id, name, value)                           -- ip_id:55:ip                    -> 15.80.125.22

  if enum_type == 'bulk' then
    -- Slug to 'natural' name -- not really necessary
    set(typename..'_slug', slug, name, value)                   -- access_slug:42:ip              -> 15.80.125.22
    sadd(name, value, typename..'_slug_', slug)                 -- ip:15.80.125.22:access_slug_   -> 42

    -- Remember that the ip:w.x.y.z is storing the slug
    sadd(typename..'_type_holder', 'slug', name, value)         -- access_type_holder:slug:ip     -> 15.80.125.22
  end
end

-- Add a string (essentiall random data)
local function add_string_slug(name, value, id)
  local slug = curr_slug()

  -- Slug to 'natural' name
  set(typename..'_slug', slug, name, value)                   -- access_slug:42:user_agent              -> <<jibberish>>
end

-- The item being stored is already a number (http resp)
local function add_nenum_slug(name, value, id)
  local slug = curr_slug()

  -- Slug to 'natural' name 
  set(typename..'_slug', slug, name, value)                   -- access_slug:42:resp_code              -> 404
  sadd(name, value, typename..'_slug_', slug)                 -- resp_code:404:access_slug_            -> 42

  -- Remember that the resp_code:w.x.y.z is storing the slug
  sadd(typename..'_type_holder', 'slug', name, value)         -- access_type_holder:slug:resp_code     -> 404
end

local function add_ln_slug(name, value, magn)
  local slug = curr_slug()
  set(typename..'_slug', slug, name..'_magn', magn)
  set(typename..'_slug', slug, name, value)

  sadd(name..'_magn', magn, typename..'_slug_', slug)
  sadd(typename..'_type_holder', 'slug', name..'_magn', magn)
end

local function delete_slug_at(slug, when)
  local k_slug_exp    = key(typename..'_slug', slug, 'expiration')

  if redis.call('EXISTS', k_slug_exp) == 1 then
    local exp = redis.pcall('GET', k_slug_exp)
    redis.pcall('SREM', key(typename..'_delete_at', exp, 'slug'), slug)
    redis.pcall('DEL', k_slug_exp)
  end

  if when ~= 'never' then
    redis.pcall('SADD', key(typename..'_delete_at', when, 'slug'), slug)
    redis.pcall('SET', k_slug_exp, when)
  end
end

local function delete_current_slug_at(when)
  return delete_slug_at(curr_slug(), when)
end

local function put_slug_in(slug, group)
  redis.call('SADD', group, slug)
  local date = redis.call('GET', key(typename..'_slug', slug, 'date'))

  delete_slug_at(slug, date)
end

local function put_current_slug_in(group)
  return put_slug_in(curr_slug(), group)
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

local function start_slug(...)
  local _, n, y, mo, d, h, m, s

  _, _, y, mo, d, h, m, s = string.find(arg[1], '(%d%d%d%d).(%d%d).(%d%d).(%d%d).(%d%d).(%d%d)')
  y = tonumber(y)
  mo = tonumber(mo)
  d = tonumber(d)
  h = tonumber(h)
  m = tonumber(m)
  s = tonumber(s)

  set(typename, 'time', 'date', string.format('%04d/%02d/%02d', y, mo, d))
  set(typename, 'date', 'time', string.format('%04d/%02d/%02d/%02d/%02d/%02d', y, mo, d, h, m, s))
  set(typename, 'date', 'second', string.format('%02d/%02d/%02d', h, m, s))

  local slug = incr('token', typename..'_slug', 'id')
  set(typename..'_slug', slug, 'n_second', (((h*60) +m)*60 + s))
  set(typename..'_slug', slug, 'date', string.format('%04d/%02d/%02d', y, mo, d))
  set(typename..'_slug', slug, 'second', string.format('%02d/%02d/%02d', h, m, s))

  -- Set the default expiration
  local exp = future_minute(180, y, mo, d, h, m)
  --local exp = future_minute(18, y, mo, d, h, m)
  sadd(typename..'_delete_at', exp, 'slug', slug)
  set(typename..'_slug', slug, 'expiration', exp)

  for _, n in pairs(redis.call('SINTER', key(typename, 'field', 'have_type'), key(typename, 'field', 'have_name'))) do
    n = tonumber(n)
    local value = arg[n]
    --if value ~= '-' then
      set_f(n, value)
    --end
  end
end

local abort_commit = 0

local function _commit_slug()
  if abort_commit ~= 0 then
    return
  end

  local slug = curr_slug()

  -- use SMEMBERS to get field ids, and commit them
  local _, n, a, b, c, d
  for _, n in pairs(redis.call('SINTER', key('current_slug', typename, 'present_fields'), key(typename, 'field', 'have_type'), key(typename, 'field', 'have_name'))) do
    n = tonumber(n)

    local value = f(n)
    if value ~= '-' then
      local ty = field_type(n)
      local name = field_name(n)

      if (ty == 'enum') then
        local id = get_id(name, value)
        add_slug(name, value, id)

      elseif ty == 'string' then

        local id = get_id(name, value)
        add_slug(name, value, id)

      elseif (ty == 'ip_addr') then
        -- An IP address.  Convert to int
        local ip = value
        _, _, a, b, c, d = string.find(ip, '(%d+).(%d+).(%d+).(%d+)')
        local id = (((((a*256) + b)*256) + c)*256 +d)

        add_slug(name, ip, id)

      elseif (ty == 'ln') then
        -- A number, but with a very large range
        add_ln_slug(name, value, math.floor(math.log(value) * log2inv))

      elseif (ty == 'nenum') then
        -- Like an enum, but since it is already numeric, dont need to generate id (like 200 for http code)
        add_nenum_slug(name, value, value)
      end
    end

  end

  -- Put this slug into the current second
  sadd('current_second', typename, typename..'_slug_', slug)

  -- Clean up
  del('current_slug', typename, 'present_fields')

end

local function handle_delete_delayed(force)
  local i, kind, name, this_key

  if redis.call('EXISTS', typename..'_delete_delayed:slug') == 1 then
    if force == 1 or redis.call('SCARD', typename..'_delete_delayed:slug') > 3000 then
      for _, kind in pairs(smembers(typename..'_type_holder', 'slug', 'name')) do
        for _, name in pairs(smembers(typename..'_type_holder', 'slug', kind)) do
          this_key = key(kind, name, typename..'_slug_')
          redis.call('SDIFFSTORE', this_key, this_key, typename..'_delete_delayed:slug')
        end
      end
      redis.call('DEL', typename..'_delete_delayed:slug')
    end
  end
end

local function _openSecond(s)
end

local s_current_second  = skey('current_second', typename)
local s_current_minute  = skey('current_minute', typename)

local function _closeSecond(s_, prev_s)
  local s = string.match(s_, '(%d%d)$')
  redis.call('RENAME', s_current_second, 'second:'..s..':'..typename..'_slug_')
end

local function _openMinute()
end

local function _promote_current_seconds()
  redis.pcall('SUNIONSTORE', s_current_minute, s_current_minute, 
    'second:00:'..typename..'_slug_', 'second:01:'..typename..'_slug_', 'second:02:'..typename..'_slug_', 'second:03:'..typename..'_slug_', 'second:04:'..typename..'_slug_',
    'second:05:'..typename..'_slug_', 'second:06:'..typename..'_slug_', 'second:07:'..typename..'_slug_', 'second:08:'..typename..'_slug_', 'second:09:'..typename..'_slug_',
    'second:10:'..typename..'_slug_', 'second:11:'..typename..'_slug_', 'second:12:'..typename..'_slug_', 'second:13:'..typename..'_slug_', 'second:14:'..typename..'_slug_',
    'second:15:'..typename..'_slug_', 'second:16:'..typename..'_slug_', 'second:17:'..typename..'_slug_', 'second:18:'..typename..'_slug_', 'second:19:'..typename..'_slug_',
    'second:20:'..typename..'_slug_', 'second:21:'..typename..'_slug_', 'second:22:'..typename..'_slug_', 'second:23:'..typename..'_slug_', 'second:24:'..typename..'_slug_',
    'second:25:'..typename..'_slug_', 'second:26:'..typename..'_slug_', 'second:27:'..typename..'_slug_', 'second:28:'..typename..'_slug_', 'second:29:'..typename..'_slug_',
    'second:30:'..typename..'_slug_', 'second:31:'..typename..'_slug_', 'second:32:'..typename..'_slug_', 'second:33:'..typename..'_slug_', 'second:34:'..typename..'_slug_',
    'second:35:'..typename..'_slug_', 'second:36:'..typename..'_slug_', 'second:37:'..typename..'_slug_', 'second:38:'..typename..'_slug_', 'second:39:'..typename..'_slug_',
    'second:30:'..typename..'_slug_', 'second:41:'..typename..'_slug_', 'second:42:'..typename..'_slug_', 'second:43:'..typename..'_slug_', 'second:44:'..typename..'_slug_',
    'second:45:'..typename..'_slug_', 'second:46:'..typename..'_slug_', 'second:47:'..typename..'_slug_', 'second:48:'..typename..'_slug_', 'second:49:'..typename..'_slug_',
    'second:50:'..typename..'_slug_', 'second:51:'..typename..'_slug_', 'second:52:'..typename..'_slug_', 'second:53:'..typename..'_slug_', 'second:54:'..typename..'_slug_',
    'second:55:'..typename..'_slug_', 'second:56:'..typename..'_slug_', 'second:57:'..typename..'_slug_', 'second:58:'..typename..'_slug_', 'second:59:'..typename..'_slug_'
    )
  redis.pcall('DEL', 
    'second:00:'..typename..'_slug_', 'second:01:'..typename..'_slug_', 'second:02:'..typename..'_slug_', 'second:03:'..typename..'_slug_', 'second:04:'..typename..'_slug_',
    'second:05:'..typename..'_slug_', 'second:06:'..typename..'_slug_', 'second:07:'..typename..'_slug_', 'second:08:'..typename..'_slug_', 'second:09:'..typename..'_slug_',
    'second:10:'..typename..'_slug_', 'second:11:'..typename..'_slug_', 'second:12:'..typename..'_slug_', 'second:13:'..typename..'_slug_', 'second:14:'..typename..'_slug_',
    'second:15:'..typename..'_slug_', 'second:16:'..typename..'_slug_', 'second:17:'..typename..'_slug_', 'second:18:'..typename..'_slug_', 'second:19:'..typename..'_slug_',
    'second:20:'..typename..'_slug_', 'second:21:'..typename..'_slug_', 'second:22:'..typename..'_slug_', 'second:23:'..typename..'_slug_', 'second:24:'..typename..'_slug_',
    'second:25:'..typename..'_slug_', 'second:26:'..typename..'_slug_', 'second:27:'..typename..'_slug_', 'second:28:'..typename..'_slug_', 'second:29:'..typename..'_slug_',
    'second:30:'..typename..'_slug_', 'second:31:'..typename..'_slug_', 'second:32:'..typename..'_slug_', 'second:33:'..typename..'_slug_', 'second:34:'..typename..'_slug_',
    'second:35:'..typename..'_slug_', 'second:36:'..typename..'_slug_', 'second:37:'..typename..'_slug_', 'second:38:'..typename..'_slug_', 'second:39:'..typename..'_slug_',
    'second:30:'..typename..'_slug_', 'second:41:'..typename..'_slug_', 'second:42:'..typename..'_slug_', 'second:43:'..typename..'_slug_', 'second:44:'..typename..'_slug_',
    'second:45:'..typename..'_slug_', 'second:46:'..typename..'_slug_', 'second:47:'..typename..'_slug_', 'second:48:'..typename..'_slug_', 'second:49:'..typename..'_slug_',
    'second:50:'..typename..'_slug_', 'second:51:'..typename..'_slug_', 'second:52:'..typename..'_slug_', 'second:53:'..typename..'_slug_', 'second:54:'..typename..'_slug_',
    'second:55:'..typename..'_slug_', 'second:56:'..typename..'_slug_', 'second:57:'..typename..'_slug_', 'second:58:'..typename..'_slug_', 'second:59:'..typename..'_slug_'
    )
end

local function _closeMinute(m_, prev_m)
  redis.log(redis.LOG_NOTICE, 'Closing minute: '..prev_m)
  _promote_current_seconds()

  if enum_type == 'serialize' then
    local _, kind, name, this_key, name_id, slug, m, y, mo, d, h, min, count

    _, _, y, mo, d, h, min = string.find(prev_m, '(%d%d%d%d).(%d%d).(%d%d).(%d%d).(%d%d)')
    y = tonumber(y)
    mo = tonumber(mo)
    d = tonumber(d)
    h = tonumber(h)
    min = tonumber(min)

    count = 1
    if prev_m == m_ then
      count = 0
    end

    repeat
      m = future_minute(count, y, mo, d, h, min)

      local delete_at_key = key(typename..'_delete_at', m, 'slug')

      if redis.call('EXISTS', delete_at_key) == 1 then

        -- Remove the saved slugs
        local saved_key = key(typename, 'saved', 'slug')
        if redis.call('EXISTS', saved_key) == 1 then
          if redis.call('SCARD',  saved_key) > 0 then
            redis.call('SDIFFSTORE', delete_at_key, delete_at_key, saved_key)
          end
        end

        -- Loop over all the types that hold the slugs that we are deleting, and remove 
        -- them from their sets

        -- Now, remove all the slugs' data
        for _, name in pairs(smembers(typename, 'field', 'names')) do
          for _, slug in pairs(redis.call('SMEMBERS', delete_at_key)) do
            redis.pcall('DEL', key(typename..'_slug', slug, name))
            redis.pcall('DEL', key(typename..'_slug', slug, name..'_id'))
            redis.pcall('DEL', key(typename..'_slug', slug, name..'_magn'))
          end
        end

        redis.call('SUNIONSTORE', typename..'_delete_delayed:slug', typename..'_delete_delayed:slug', delete_at_key)
        redis.call('SET', 'debug:close_minute', m..' '..count)
        redis.call('INCR', 'debug:close_minute:count')

        redis.call('DEL', delete_at_key)
      end

      count = count + 1
    until m == m_

    handle_delete_delayed(0)
  end
end

local function _openHour()
  if exists('keyspace', 'hour_token_start', typename..'_slug') == 1 then
    set('keyspace', 'prev_hour_token_start', typename..'_slug', get('keyspace', 'hour_token_start', typename..'_slug'))
  end
  --set('keyspace', 'hour_token_start', typename..'_slug', curr_slug()+1)
end

local function _closeHour(h, prev_h)
  if enum_type == 'serialize' then
    local i, kind, name, this_key

    handle_delete_delayed(0)
    --[[
    if redis.call('EXISTS', typename..'_delete_delayed:slug') == 1 then
      for _, kind in pairs(smembers(typename..'_type_holder', 'slug', 'name')) do
        for _, name in pairs(smembers(typename..'_type_holder', 'slug', kind)) do
          this_key = key(kind, name, typename..'_slug_')
          redis.call('SDIFFSTORE', this_key, this_key, typename..'_delete_delayed:slug')
        end
      end
      redis.call('DEL', typename..'_delete_delayed:slug')
    end
    --]]

    --[[
    if exists('keyspace', 'hour_token_close', typename..'_slug') == 1 and exists('keyspace', 'prev_hour_token_start', typename..'_slug') == 1 then
      local _, name_id, name, prev_start, prev_close, members

      prev_start = get('keyspace', 'prev_hour_token_start', typename..'_slug')
      prev_close = get('keyspace', 'hour_token_close', typename..'_slug')

      members = smembers(typename, 'field', 'have_name')
      for _, name_id in pairs(members) do 
        name = get(typename, 'f'..name_id, 'name')

        for i = prev_start, prev_close do
          del(typename..'_slug', i, name)
          del(typename..'_slug', i, name..'_id')
        end
      end
    end
    --]]

    set('keyspace', 'hour_token_close', typename..'_slug', curr_slug())
  end
end

local function _closeDay(d, prev_d)
  redis.call('SADD', key(typename, 'close_day', 'date'), prev_d)

  if enum_type == 'serialize' then
    --local _, slug, name
    --local delete_at_key = key(typename..'_delete_at', prev_d, 'slug')

    --redis.log(redis.LOG_NOTICE, 'Closing minute: '..m)

    --if redis.call('EXISTS', delete_at_key) == 1 then

    --  -- Remove the saved slugs
    --  local saved_key = key(typename, 'saved', 'slug')
    --  if redis.call('EXISTS', saved_key) == 1 then
    --    if redis.call('SCARD',  saved_key) > 0 then
    --      redis.call('SDIFFSTORE', delete_at_key, delete_at_key, saved_key)
    --    end
    --  end

    --  -- Loop over all the types that hold the slugs that we are deleting, and remove 
    --  -- them from their sets

    --  local names = smembers(typename, 'field', 'names')
    --  local iterations = 500
    --  repeat
    --    local sids = slice(redis.call('SMEMBERS', delete_at_key), 1, 32)
    --    --local sids  = redis.call('SRANDMEMBER', delete_at_key, 32)
    --    local items = {}
    --    local items_id = {}
    --    for _, slug in pairs(sids) do
    --      for _, name in pairs(names) do
    --        table.insert(items, key(typename..'_slug', slug, name))
    --        table.insert(items_id, key(typename..'_slug', slug, name..'_id'))
    --      end
    --    end
    --    redis.pcall('DEL', unpack(items))
    --    redis.pcall('DEL', unpack(items_id))
    --    redis.call('SREM', delete_at_key, unpack(sids))
    --    iterations = iterations - 1
    --  until redis.call('SCARD', delete_at_key) == 0 or iterations == 0

    --  -- Now, remove all the slugs' data
    --  --for _, name in pairs(smembers(typename, 'field', 'names')) do
    --  --  for _, slug in pairs(redis.call('SMEMBERS', delete_at_key)) do
    --  --    redis.pcall('DEL', key(typename..'_slug', slug, name))
    --  --    redis.pcall('DEL', key(typename..'_slug', slug, name..'_id'))
    --  --  end
    --  --end

    --  redis.call('SUNIONSTORE', typename..'_delete_delayed:slug', typename..'_delete_delayed:slug', delete_at_key)
    --  redis.call('DEL', delete_at_key)
    --end
    handle_delete_delayed(1)
  end
end

local function _closeAll()
  handle_delete_delayed(1)
end

-- user content here

