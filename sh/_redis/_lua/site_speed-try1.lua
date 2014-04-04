
redis.call('DEL', 'ppers:slug_', 'pp:slug_', 'onramp:slug_')

redis.call('SINTERSTORE', 'pp:slug_', 'url:/projects:slug_', 'method:post:slug_')
local pp_ip_ids = convert_to('slug', redis.call('SMEMBERS', 'pp:slug_'), 'ip_id')
local all_slugs_for_pp_ip_ids = convert_keys_to('ip_id', pp_ip_ids, 'slug_')
redis.call('SUNIONSTORE', 'ppers:slug_', unpack(all_slugs_for_pp_ip_ids))

redis.call('SUNIONSTORE', 'onramp:slug_', 'url:/:slug_', 'url:/arts:slug_', 'url:/merchants:slug_')
redis.call('SINTERSTORE', 'onramp:slug_', 'onramp:slug_', 'ppers:slug_')

del_star('slug:*:onramp_slug')
del_star('slug:*:speed_to_pp')

for day = 0, 100 do
  if redis.call('SCARD', 'day_id:'..day..':slug_') > 0 then
    for min = 0, 1439 do

      local onramp_minute_slugs = redis.call('SINTER', 'onramp:slug_', 'minute:'..min..':slug_', 'day_id:'..day..':slug_')
      if #onramp_minute_slugs > 0 then
        table.sort(onramp_minute_slugs)
        local onramp_minute_ip_ids = convert_to('slug', onramp_minute_slugs , 'ip_id')
        for i, slug in pairs(onramp_minute_slugs) do
          local ip_id = onramp_minute_ip_ids[i]
          --ip_id = redis.call('GET', 'slug:'..slug..':ip_id')

          redis.call('SETNX', 'onramp-ip_id:'..ip_id..':slug', slug)
        end
      end

      local pp_minute_slugs = redis.call('SINTER', 'pp:slug_', 'minute:'..min..':slug_', 'day_id:'..day..':slug_')
      if #pp_minute_slugs > 0 then
        table.sort(pp_minute_slugs)
        local pp_minute_ip_ids = convert_to('slug', pp_minute_slugs , 'ip_id')
        for i, slug in pairs(pp_minute_slugs) do
          local ip_id = pp_minute_ip_ids[i]
          --ip_id = redis.call('GET', 'slug:'..slug..':ip_id')

          if redis.call('EXISTS', 'onramp-ip_id:'..ip_id..':slug') == 1 then
            -- Found a POST /projects, onramp pair
            local onramp_slug = redis.call('GET', 'onramp-ip_id:'..ip_id..':slug')
            local start = redis.call('GET', 'slug:'..onramp_slug..':second_of_day')
            local stop = redis.call('GET', 'slug:'..slug..':second_of_day')
            local speed = stop - start
            redis.call('SET', 'slug:'..slug..':onramp_slug', onramp_slug) 
            redis.call('SET', 'slug:'..slug..':speed_to_pp', speed) 
            redis.call('DEL', 'onramp-ip_id:'..ip_id..':slug')
          end
        end
      end
    end
    del_star('onramp-ip_id:*:slug')
  end
end

return #redis.call('KEYS', 'slug:*:speed_to_pp')

