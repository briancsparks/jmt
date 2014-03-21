
local count = 0
for _,key in pairs(redis.call('KEYS', ARGV[1])) do
  count = count + 1
  redis.call('MOVE', key, ARGV[2])
end

return count

