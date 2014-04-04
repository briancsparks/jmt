
--redis.call('DEL', 'has_onrampA:slug_')

--for day = 0, 1000 do
  
  local day = ARGV[1]
  local constraint = day
  if #KEYS > 0 then
    constraint = KEYS[1]
  end
  local day_key = 'day_id:'..day..':slug_'
  --if day > 10 and redis.call('EXISTS', day_key) == 0 then break end

  --for _, requested_key in pairs(the_keys) do
    redis.call('SINTERSTORE', 'day:current:slug_', day_key, constraint)

    log('Processing '..day_key..', '..': '..redis.call('SCARD', 'day:current:slug_'))
    if redis.call('SCARD', 'day:current:slug_') > 0 then

      local pp_ip_ids = convert_to('slug', redis.call('SINTER', 'url:/projects:slug_', 'method:post:slug_', 'day:current:slug_'), 'ip_id')
      if #pp_ip_ids > 0 then
        redis.call('SUNIONSTORE', 'ppers:slug_', unpack(convert_keys_to('ip_id', pp_ip_ids  , 'slug_')))
      end
      redis.call('SUNIONSTORE', 'onramp:slug_', 'url:/:slug_', 'url:/arts:slug_', 'url:/merchants:slug_')

      for min = 0, 1439 do
        redis.call('SINTERSTORE', 'min:current:slug_', 'day:current:slug_', 'n_minute:'..min..':slug_')

        local onrampA, ip_idsA = sintersort_plus1('slug', 'ip_id', 'ppers:slug_', 'onramp:slug_', 'min:current:slug_')
        if #onrampA > 0 then
          for i, slug in pairs(onrampA) do
            local ip_id = ip_idsA[i]

            local onramp_key = 'onramp-ip_id:'..ip_id..':slug'
            redis.call('SADD', 'onramp_keys', onramp_key)
            redis.call('SETNX', onramp_key, slug)
          end
        end

        local pprojects = redis.call('SINTER', 'ppers:slug_', 'url:/projects:slug_', 'method:post:slug_', 'min:current:slug_')
        if #pprojects > 0 then
          table.sort(pprojects)
          local ip_ids = convert_to('slug', pprojects , 'ip_id')
          for i, slug in pairs(pprojects) do
            local ip_id = ip_ids[i]
            --ip_id = redis.call('GET', 'slug:'..slug..':ip_id')

            if redis.call('EXISTS', 'onramp-ip_id:'..ip_id..':slug') == 1 then
              -- Found a POST /projects, onramp pair
              local onramp_slug = redis.call('GET', 'onramp-ip_id:'..ip_id..':slug')
              if onramp_slug < slug then
                redis.call('SET', 'slug:'..slug..':onramp_slug', onramp_slug) 
                redis.call('DEL', 'onramp-ip_id:'..ip_id..':slug')
                redis.call('SADD', 'has_onrampA:slug_', slug)
              end
            end
          end
        end
      end
    end
  --end
  for _, onramp_key in pairs(redis.call('SMEMBERS', 'onramp_keys')) do 
    redis.call('DEL', onramp_key)
  end
  redis.call('DEL', 'onramp_keys')
--end

-- Now go through all the onramp slugs we just created and set the onramp-to-pp time
--for _, onramp_key in pairs(redis.call('KEYS', 'slug:*:onramp_slug')) do
for _, slug in pairs(redis.call('SMEMBERS', 'has_onrampA:slug_')) do 
  --local onramp_slug = redis.call('GET', onramp_key)
  --local slug = string.match(onramp_key, '^slug:(.*):onramp_slug$')
  local onramp_slug = get('slug', slug, 'onramp_slug')
  local start = get('slug', onramp_slug, 'n_second')
  local stop = get('slug', slug, 'n_second')
  local speed = stop - start

  set('slug', slug, 'speed_to_pp', speed)
  redis.call('SADD', 'has_onramp:slug_', slug)
end

local ret = redis.call('SCARD', 'has_onrampA:slug_')
redis.call('DEL', 'has_onrampA:slug_')
return ret

