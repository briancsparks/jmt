
local members = redis.call('SMEMBERS', KEYS[1])
return convert_to(ARGV[1], members, ARGV[2])

