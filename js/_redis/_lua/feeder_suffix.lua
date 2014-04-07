
local cmd = ARGV[1]
local args = slice(ARGV, 2)

if cmd == 'init' then
  return 1
elseif cmd == 'start_slug' then
  return 2

elseif cmd == 'commit_slug' then
  return 3

elseif cmd == '_commit_slug' then
  local _

  _, _, y, mo, d, h, m, s = string.find(args[1], '(%d%d%d%d).(%d%d).(%d%d).(%d%d).(%d%d).(%d%d)')
  y = tonumber(y)
  mo = tonumber(mo)
  d = tonumber(d)
  h = tonumber(h)
  m = tonumber(m)
  s = tonumber(s)

  curr_slug_time = string.format('%04d/%02d/%02d/%02d/%02d/%02d', y, mo, d, h, m, s)
  curr_slug_date = string.format('%04d/%02d/%02d', y, mo, d)
  curr_slug_second = string.format('%02d/%02d/%02d', h, m, s)
  curr_slug_n_second = (((h*60) +m)*60 + s)

  curr_slug = incr('token', typename..'_slug', 'id')
  --redis.log(redis.LOG_NOTICE, '__commit_slug(9)')

  __user_commit_slug(unpack(args))
  __commit_slug2()


elseif cmd == '_openSecond' then
  return _openSecond(unpack(args))
elseif cmd == '_openMinute' then
  return _openMinute(unpack(args))
elseif cmd == '_openHour' then
  return _openHour(unpack(args))
elseif cmd == '_openDay' then
  return _openDay(unpack(args))
elseif cmd == '_openMonth' then
  return _openMonth(unpack(args))
elseif cmd == '_openYear' then
  return _openYear(unpack(args))

elseif cmd == '_closeSecond' then
  return _closeSecond(unpack(args))
elseif cmd == '_closeMinute' then
  return _closeMinute(unpack(args))
elseif cmd == '_closeHour' then
  return _closeHour(unpack(args))
elseif cmd == '_closeDay' then
  return _closeDay(unpack(args))
elseif cmd == '_closeMonth' then
  return _closeMonth(unpack(args))
elseif cmd == '_closeYear' then
  return _closeYear(unpack(args))
elseif cmd == '_closeAll' then
  return _closeAll(unpack(args))

elseif cmd == 'closeSecond' then
  return closeSecond(unpack(args))
elseif cmd == 'closeMinute' then
  return closeMinute(unpack(args))
elseif cmd == 'closeHour' then
  return closeHour(unpack(args))
elseif cmd == 'closeDay' then
  return closeDay(unpack(args))
elseif cmd == 'closeMonth' then
  return closeMonth(unpack(args))
elseif cmd == 'closeYear' then
  return closeYear(unpack(args))
end

