
for _,key in pairs(redis.call('KEYS', ARGV[1] .. ':*:' .. ARGV[2])) do
  local a=key:match(':([^:]+):')
  local b=redis.call('GET', ARGV[1] .. ':' .. a .. ':' .. ARGV[2])
  local c=redis.call('GET', ARGV[2] .. ':' .. b .. ':' .. ARGV[3])
  redis.call('SET', ARGV[1] .. ':' .. a .. ':' .. ARGV[3], c)
end

