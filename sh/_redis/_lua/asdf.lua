
do return 1 end

local minutes = {}
for min = 0, 60 do
  local min2 = min + 900
  table.insert(minutes, 'n_minute:'..min2..':slug_')
end

redis.call('SUNIONSTORE', 'mins:slug_', unpack(minutes))

--local onramp, onramp_ip_ids = sintersort_plus1('slug', 'ip_id', 'onramp:slug_', KEYS[1], 'mins:slug_')
--local pp, pp_ip_ids = sintersort_plus1('slug', 'ip_id', 'url:/projects:slug_', 'method:post:slug_', KEYS[1], 'mins:slug_')

local onramp, onramp_ip_ids = sintersort_plus1('slug', 'ip_id', 'onramp:slug_', KEYS[1])
local pp, pp_ip_ids = sintersort_plus1('slug', 'ip_id', 'url:/projects:slug_', 'method:post:slug_', KEYS[1])

local j = 1
local curr = onramp[j]
local onramp_ip = onramp_ip_ids[j]
for i, pproject in pairs(pp) do
  local ip = pp_ip_ids[i]

  while curr < pproject do
    redis.call('SETNX', 'ip_onramp:'..onramp_ip..':slug', curr)
    j = j + 1
    curr = onramp[j]
    onramp_ip = onramp_ip_ids[j]
  end

  if redis.call('EXISTS', 'ip_onramp:'..ip..':slug') == 1 then
    local onramp_slug = redis.call('GET', 'ip_onramp:'..ip..':slug')
    redis.call('SET', 'slug:'..pproject..':onramp_slugg', onramp_slug)
    redis.call('SADD', 'slugs_with_onramp:slug_', pproject)
  end
end

return redis.call('SCARD', 'slugs_with_onramp:slug_')

