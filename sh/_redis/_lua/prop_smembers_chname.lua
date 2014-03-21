
for _,member in pairs(redis.call('SMEMBERS', ARGV[1]..':'..ARGV[2])) do
  local member2=redis.call('GET', ARGV[3] .. ':' .. member .. ':' .. ARGV[4])
  redis.call('SADD', ARGV[1]..':'..ARGV[5], member2)
end

return redis.call('SCARD', ARGV[1]..':'..ARGV[5])

