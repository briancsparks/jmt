
for _,member in pairs(redis.call('SMEMBERS', ARGV[1]..':'..ARGV[2]..'s')) do
  local member2=redis.call('GET', ARGV[2] .. ':' .. member .. ':' .. ARGV[3])
  redis.call('SADD', ARGV[1]..':'..ARGV[3]..'s', member2)
end

return redis.call('SCARD', ARGV[1]..':'..ARGV[3]..'s')

