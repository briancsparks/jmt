
local ret = {}

local onramp, ip_ids = sintersort_plus1('slug', 'ip_id', 'ppers:slug_', 'onramp:slug_', 'min:current:slug_')
table.insert(ret, 'adding '..#onramp)
if #onramp > 0 then
  for i, slug in pairs(onramp) do
    local ip_id = ip_ids[i]

    sadd_temp('SETNX', 'onramp-ip_id', ip_id, 'slug', slug)
  end
end

ret = #onramp
return ret

