
for _,key in pairs(redis.call('KEYS', ARGV[1] .. ':*:' .. ARGV[2])) do
  local Akey = key:match(':([^:]+):')
  local b = redis.call('GET', ARGV[1] .. ':' .. Akey .. ':' .. ARGV[2])
  local c = redis.call('GET', ARGV[3] .. ':' .. b .. ':' .. ARGV[4])
  redis.call('SET', ARGV[1] .. ':' .. Akey .. ':' .. ARGV[5], c)
end

