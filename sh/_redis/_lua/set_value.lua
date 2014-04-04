
local obj = redis.call('GET', ARGV[2])
set(ARGV[1], obj, ARGV[3], ARGV[4])
return obj
