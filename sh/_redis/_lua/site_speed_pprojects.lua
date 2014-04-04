
local ret = {}

local pprojects, ip_ids = sintersort_plus1('slug', 'ip_id', 'ppers:slug_', 'url:/projects:slug_', 'method:post:slug_', 'min:current:slug_')
table.insert(ret, 'adding '..#pprojects)
if #pprojects > 0 then
  for i, slug in pairs(pprojects) do
    local ip_id = ip_ids[i]

    if redis.call('EXISTS', 'onramp-ip_id:'..ip_id..':slug') == 1 then
      -- Found a POST /projects, onramp pair
      local onramp_slug = redis.call('GET', 'onramp-ip_id:'..ip_id..':slug')
      if onramp_slug < slug then
        sadd_temp2('SET', 'slug_onramp', 'slug', slug, 'onramp_slug', onramp_slug)
        --redis.call('SET', 'slug:'..slug..':onramp_slug', onramp_slug) 
        redis.call('DEL', 'onramp-ip_id:'..ip_id..':slug')
        redis.call('SADD', 'has_onrampA:slug_', slug)
      else
        redis.call('SADD', 'missed_onrampA:slug_', slug)
      end
    else
      redis.call('SADD', 'missed_onrampA:slug_', slug)
    end
  end
end

ret = #pprojects
return ret

