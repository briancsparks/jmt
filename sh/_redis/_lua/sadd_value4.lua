
local obj = redis.call('GET', ARGV[2])
sadd(ARGV[1], obj, ARGV[3], ARGV[4])
return obj
