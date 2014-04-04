

-- Now go through all the onramp slugs we just created and set the onramp-to-pp time
for _, slug in pairs(redis.call('SMEMBERS', 'missed_onrampA:slug_')) do 
  redis.call('SADD', 'missed_onramp:slug_', slug)
end
redis.call('DEL', 'missed_onrampA:slug_')

for _, slug in pairs(redis.call('SMEMBERS', 'has_onrampA:slug_')) do 
  local onramp_slug = get('slug', slug, 'onramp_slug')
  local start = get('slug', onramp_slug, 'n_second')
  local stop = get('slug', slug, 'n_second')
  local speed = stop - start

  set('slug', slug, 'speed_to_pp', speed)
  redis.call('SADD', 'has_onramp:slug_', slug)
end

local ret = redis.call('SCARD', 'has_onrampA:slug_')
redis.call('DEL', 'has_onrampA:slug_')

clean_temp_keys(0, 'onramp-ip_id')

return ret

