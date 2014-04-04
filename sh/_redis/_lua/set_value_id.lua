
local obj = redis.call('GET', KEYS[1])
local value = redis.call('GET', KEYS[2])
set(ARGV[1], obj, ARGV[2], value)
return obj
