
local value = redis.call('GET', KEYS[1])
redis.call('SADD', KEYS[2], value)
return value
