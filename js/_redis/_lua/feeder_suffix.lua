
local cmd = ARGV[1]
local args = slice(ARGV, 2)

if cmd == 'init' then
  _init(unpack(args))
  return init(unpack(args))
elseif cmd == 'start_slug' then
  return start_slug(unpack(args))
elseif cmd == 'commit_slug' then
  commit_slug(unpack(args))
  return _commit_slug(unpack(args))

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

