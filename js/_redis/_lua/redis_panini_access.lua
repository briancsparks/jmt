
local s_current_second  = skey('current_second', typename)
local s_model_projects  = skey('model', 'projects')
local s_method_post     = skey('method', 'post')

local s_cs_post_project = skey('current_second', 'project-post')
local s_post_project    = skey(typename, 'project-post')
local s_cs_onramp       = skey('current_second', 'onramp')
local s_onramp          = skey(typename, 'onramp')
local s_cs_checkout     = skey('current_second', 'checkout')
local s_checkout        = skey(typename, 'checkout')

local s_has_onrampA     = skey(typename, 'has_onrampA')
local s_has_onramp      = skey(typename, 'has_onramp')

local s_lone_pproject   = skey(typename, 'lone_pproject')

local s_has_time_to_pproject      = skey(typename, 'has_time_to_pproject')
local s_has_subsequent_pprojectA  = skey(typename, 'has_subsequent_pprojectA')
local s_has_subsequent_pproject   = skey(typename, 'has_subsequent_pproject')

local s_has_onramp_ip_id          = skey(typename, 'has_onramp_ip_id')

local function init()
end

local function __user_commit_slug(...)
  if enum_type == 'serialize' then
    local method   = arg[6]
    local action   = arg[15]
    local pathname = arg[18]

    if method == 'post' and pathname == '/projects' then
      redis.call('SADD', s_cs_post_project, curr_slug)
      curr_slug_expiration = curr_slug_date
    elseif pathname == '/arts' or pathname == '/merchants' or pathname == '/' then
      redis.call('SADD', s_cs_onramp, curr_slug)
      curr_slug_expiration = curr_slug_date
    elseif action == 'checkout_success' then
      redis.call('SADD', s_cs_checkout, curr_slug)
      curr_slug_expiration = curr_slug_date
    elseif enum_type == 'serialize' then
      abort_commit = 1
    end

    if abort_commit ~= 1 then
      __commit_slug(unpack(arg))
    end
  else
    __commit_slug(unpack(arg))
  end
end

local function closeSecond(s_, prev_s)

  if enum_type ~= 'serialize' then
    return
  end

  local s = string.match(s_, '(%d%d)$')

  -- Loop over the onramp slugs, and remember the associated IPs
  local onramp, ip_ids = slugmembers_plus1(s_cs_onramp, 'ip_id')
  if #onramp > 0 then
    local ba = {}
    for i, slug in pairs(onramp) do
      local ip_id = ip_ids[i]

      redis.call('SETNX', skey('onramp_ip_id', ip_id), slug)
      ba = bulk_sadd(ba, 200, s_has_onramp_ip_id, skey('onramp_ip_id', ip_id))
    end

    bulk_sadd(ba, 0, s_has_onramp_ip_id)

  end

  -- Move the slugs out of the way for the next second, but just rename them to be quick
  redis.call('RENAME', s_cs_onramp, 'second:'..s..':'..typename..'_onramp_slug_')

  -- Loop over the POST /projects and find the onramp slugs via the IP address that
  -- they both share
  local pprojects, ip_ids = slugmembers_plus1(s_cs_post_project, 'ip_id')
  if #pprojects > 0 then
    local bb = {}
    local bc = {}
    local bd = {}
    local be = {}
    local bf = {}
    local bg = {}

    for i, slug_ in pairs(pprojects) do
      local ip_id = ip_ids[i]
      local slug = tonumber(slug_)

      -- Is there a slug for this IP entering on an onramp?
      if redis.call('EXISTS', skey('onramp_ip_id', ip_id)) == 1 then
        local onramp_slug = tonumber(redis.call('GET', skey('onramp_ip_id', ip_id)))

        -- Make sure the onramp happened before the POST /project
        if onramp_slug < slug then

          bb = bulk_set(bb, 200, slugkey2(slug, 'onramp'), onramp_slug)
          bd = bulk_del(bd, 200, skey('onramp_ip_id', ip_id))
          be = bulk_sadd(be, 200, s_has_onrampA, slug)

        else
          bf = bulk_sadd(bf, 200, s_lone_pproject, slug)
        end
      else
        -- No onramp, see if this is a re-posting of projects
        if redis.call('EXISTS', skey('pprojects_ip_id', ip_id)) == 1 then
          local orig_pprojects_slug = tonumber(redis.call('GET', skey('pprojects_ip_id', ip_id)))
          redis.call('SADD', slugkey2(orig_pprojects_slug, 'subsequent_pproject'), slug)

          bc = bulk_set(bc, 200, slugkey2(slug, 'orig_pproject'), orig_pprojects_slug)
          bg = bulk_sadd(bg, 200, s_has_subsequent_pproject, orig_pprojects_slug)
        else
          bf = bulk_sadd(bf, 200, s_lone_pproject, slug)
        end
      end

      redis.call('SETNX', skey('pprojects_ip_id', ip_id), slug)
    end

    bulk_set(bb, 0)
    bulk_set(bc, 0)
    bulk_del(bd, 0)
    bulk_sadd(be, 0, s_has_onrampA)
    bulk_sadd(bf, 0, s_lone_pproject)
    bulk_sadd(bg, 0, s_has_subsequent_pproject)
  end

  spromote(s_cs_post_project, s_post_project)
end

local function closeMinute(a, b)

  if enum_type ~= 'serialize' then
    return
  end

  --redis.log(redis.LOG_NOTICE, 'userCloseMinute '..b)

  -- These were moved out of the way in closeSecond.  Now, put them onto permanent storage, and delete them below
  --redis.pcall('SUNIONSTORE', s_onramp, s_onramp,
  --  'second:00:'..typename..'_onramp_slug_', 'second:01:'..typename..'_onramp_slug_', 'second:02:'..typename..'_onramp_slug_', 'second:03:'..typename..'_onramp_slug_', 'second:04:'..typename..'_onramp_slug_',
  --  'second:05:'..typename..'_onramp_slug_', 'second:06:'..typename..'_onramp_slug_', 'second:07:'..typename..'_onramp_slug_', 'second:08:'..typename..'_onramp_slug_', 'second:09:'..typename..'_onramp_slug_',
  --  'second:10:'..typename..'_onramp_slug_', 'second:11:'..typename..'_onramp_slug_', 'second:12:'..typename..'_onramp_slug_', 'second:13:'..typename..'_onramp_slug_', 'second:14:'..typename..'_onramp_slug_',
  --  'second:15:'..typename..'_onramp_slug_', 'second:16:'..typename..'_onramp_slug_', 'second:17:'..typename..'_onramp_slug_', 'second:18:'..typename..'_onramp_slug_', 'second:19:'..typename..'_onramp_slug_',
  --  'second:20:'..typename..'_onramp_slug_', 'second:21:'..typename..'_onramp_slug_', 'second:22:'..typename..'_onramp_slug_', 'second:23:'..typename..'_onramp_slug_', 'second:24:'..typename..'_onramp_slug_',
  --  'second:25:'..typename..'_onramp_slug_', 'second:26:'..typename..'_onramp_slug_', 'second:27:'..typename..'_onramp_slug_', 'second:28:'..typename..'_onramp_slug_', 'second:29:'..typename..'_onramp_slug_',
  --  'second:30:'..typename..'_onramp_slug_', 'second:31:'..typename..'_onramp_slug_', 'second:32:'..typename..'_onramp_slug_', 'second:33:'..typename..'_onramp_slug_', 'second:34:'..typename..'_onramp_slug_',
  --  'second:35:'..typename..'_onramp_slug_', 'second:36:'..typename..'_onramp_slug_', 'second:37:'..typename..'_onramp_slug_', 'second:38:'..typename..'_onramp_slug_', 'second:39:'..typename..'_onramp_slug_',
  --  'second:30:'..typename..'_onramp_slug_', 'second:41:'..typename..'_onramp_slug_', 'second:42:'..typename..'_onramp_slug_', 'second:43:'..typename..'_onramp_slug_', 'second:44:'..typename..'_onramp_slug_',
  --  'second:45:'..typename..'_onramp_slug_', 'second:46:'..typename..'_onramp_slug_', 'second:47:'..typename..'_onramp_slug_', 'second:48:'..typename..'_onramp_slug_', 'second:49:'..typename..'_onramp_slug_',
  --  'second:50:'..typename..'_onramp_slug_', 'second:51:'..typename..'_onramp_slug_', 'second:52:'..typename..'_onramp_slug_', 'second:53:'..typename..'_onramp_slug_', 'second:54:'..typename..'_onramp_slug_',
  --  'second:55:'..typename..'_onramp_slug_', 'second:56:'..typename..'_onramp_slug_', 'second:57:'..typename..'_onramp_slug_', 'second:58:'..typename..'_onramp_slug_', 'second:59:'..typename..'_onramp_slug_'
  --  )
  redis.pcall('DEL', 
    'second:00:'..typename..'_onramp_slug_', 'second:01:'..typename..'_onramp_slug_', 'second:02:'..typename..'_onramp_slug_', 'second:03:'..typename..'_onramp_slug_', 'second:04:'..typename..'_onramp_slug_',
    'second:05:'..typename..'_onramp_slug_', 'second:06:'..typename..'_onramp_slug_', 'second:07:'..typename..'_onramp_slug_', 'second:08:'..typename..'_onramp_slug_', 'second:09:'..typename..'_onramp_slug_',
    'second:10:'..typename..'_onramp_slug_', 'second:11:'..typename..'_onramp_slug_', 'second:12:'..typename..'_onramp_slug_', 'second:13:'..typename..'_onramp_slug_', 'second:14:'..typename..'_onramp_slug_',
    'second:15:'..typename..'_onramp_slug_', 'second:16:'..typename..'_onramp_slug_', 'second:17:'..typename..'_onramp_slug_', 'second:18:'..typename..'_onramp_slug_', 'second:19:'..typename..'_onramp_slug_',
    'second:20:'..typename..'_onramp_slug_', 'second:21:'..typename..'_onramp_slug_', 'second:22:'..typename..'_onramp_slug_', 'second:23:'..typename..'_onramp_slug_', 'second:24:'..typename..'_onramp_slug_',
    'second:25:'..typename..'_onramp_slug_', 'second:26:'..typename..'_onramp_slug_', 'second:27:'..typename..'_onramp_slug_', 'second:28:'..typename..'_onramp_slug_', 'second:29:'..typename..'_onramp_slug_',
    'second:30:'..typename..'_onramp_slug_', 'second:31:'..typename..'_onramp_slug_', 'second:32:'..typename..'_onramp_slug_', 'second:33:'..typename..'_onramp_slug_', 'second:34:'..typename..'_onramp_slug_',
    'second:35:'..typename..'_onramp_slug_', 'second:36:'..typename..'_onramp_slug_', 'second:37:'..typename..'_onramp_slug_', 'second:38:'..typename..'_onramp_slug_', 'second:39:'..typename..'_onramp_slug_',
    'second:30:'..typename..'_onramp_slug_', 'second:41:'..typename..'_onramp_slug_', 'second:42:'..typename..'_onramp_slug_', 'second:43:'..typename..'_onramp_slug_', 'second:44:'..typename..'_onramp_slug_',
    'second:45:'..typename..'_onramp_slug_', 'second:46:'..typename..'_onramp_slug_', 'second:47:'..typename..'_onramp_slug_', 'second:48:'..typename..'_onramp_slug_', 'second:49:'..typename..'_onramp_slug_',
    'second:50:'..typename..'_onramp_slug_', 'second:51:'..typename..'_onramp_slug_', 'second:52:'..typename..'_onramp_slug_', 'second:53:'..typename..'_onramp_slug_', 'second:54:'..typename..'_onramp_slug_',
    'second:55:'..typename..'_onramp_slug_', 'second:56:'..typename..'_onramp_slug_', 'second:57:'..typename..'_onramp_slug_', 'second:58:'..typename..'_onramp_slug_', 'second:59:'..typename..'_onramp_slug_'
    )


  -- Now, compute how long things took
  local i, slug, start, stop, elapsed, onramp, aaa
  local ba = {}
  local bb = {}
  local pprojectors = redis.call('SMEMBERS', s_has_onrampA)
  table.sort(pprojectors)
  if #pprojectors > 0 then
    local onramps = convert_to(typename..'_slug', pprojectors, typename..'_onramp_slug_')

    for i, slug in pairs(pprojectors) do
      onramp = onramps[i]

      aaa = redis.call('MGET', slugkey(onramp, 'n_time'), slugkey(slug, 'n_time'))
      start, stop = aaa[1], aaa[2]
      elapsed = tonumber(stop) - tonumber(start)
      ba = bulk_set(ba, 200, slugkey(slug, 'time_to_pproject'), elapsed)
      ba = bulk_set(ba, 200, slugkey(slug, 'ln_time_to_pproject'), math.floor(math.log(elapsed) * log2inv))
      ba = bulk_set(ba, 200, slugkey(slug, 'ln2_time_to_pproject'), math.floor(2* math.log(elapsed) * log2inv))
      ba = bulk_set(ba, 200, slugkey(slug, 'ln4_time_to_pproject'), math.floor(4* math.log(elapsed) * log2inv))
      bb = bulk_sadd(bb, 200, s_has_time_to_pproject, slug)
    end

    bulk_set(ba, 0)
    bulk_sadd(bb, 0, s_has_time_to_pproject)
    spromote(s_has_onrampA, s_has_onramp)
  end

end

local function closeDay(a, b)
end

