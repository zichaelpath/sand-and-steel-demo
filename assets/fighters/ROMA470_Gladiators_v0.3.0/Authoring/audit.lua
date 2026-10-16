local root=assert(app.params.root)
local function read(path)local f=assert(io.open(path));local d=json.decode(f:read('*a'));f:close();return d end
local cat=read(root..'/Characters/catalog.json')
local result={passed=true,sources=0,frames=0,clips=0,directionalSheets=0,directionalFrames=0,checks={'Native cel/export equality','Complete non-overlapping tags','Frame durations','Two-pixel canvas margin','Helmet hair exclusion','Authored left/right equipment depth','24 fully animated appearances','Net release timing and anchors','Neutral action endpoints','Block reaction continuity','Profile planted foot world drift <= 1 pixel','Directional native export equality','Persistent unequipped net exports'}}
assert(#cat.units==6 and #cat.variants==24 and #cat.effects==2,'Incomplete catalogue')
result.checks[#result.checks+1]='Attack weapon above shield/arms with fingers above grip'
result.checks[#result.checks+1]='Every exposed attack weapon pixel survives compositing'
result.attackFramesVerified=0
result.checks[#result.checks+1]='Attack forearm, weapon and grip all above shield'
local items={};for _,group in ipairs({cat.units,cat.variants,cat.effects})do for _,u in ipairs(group)do items[#items+1]=u end end
for _,u in ipairs(items)do
 local s=app.open(root..'/'..u.source);local meta=read(root..'/'..u.data);local png=Image{fromFile=root..'/'..u.image}
 assert(#s.frames==#meta.frames,u.id..' frame count');assert(#s.tags==#meta.meta.frameTags,u.id..' tag count')
 local coverage={};local cfg=s.data~=''and json.decode(s.data)or{};local profiles={}
 for _,t in ipairs(s.tags)do
  local tag;for _,a in ipairs(meta.meta.frameTags)do if a.name==t.name then tag=a end end
  assert(tag and tag.from==t.fromFrame.frameNumber-1 and tag.to==t.toFrame.frameNumber-1,u.id..' tag '..t.name)
  for f=tag.from,tag.to do assert(not coverage[f],u.id..' overlapping tags');coverage[f]=true end
  if t.name=='left_Hold'or t.name=='right_Hold'then local a=Image(128,128);a:drawSprite(s,t.fromFrame.frameNumber+2);profiles[t.name]=a end
 end
 if profiles.left_Hold then
  local flipped=Image(profiles.right_Hold);flipped:flip(FlipType.HORIZONTAL)
  assert(flipped.bytes~=profiles.left_Hold.bytes,u.id..' mirrored equipment instead of authored side')
 end
 for n,f in ipairs(meta.frames)do
  assert(coverage[n-1],u.id..' uncovered frame')
  local a=Image(128,128);a:drawSprite(s,n);assert(not a:isEmpty(),u.id..' blank frame '..n)
  local b=Image(png,Rectangle(f.frame.x,f.frame.y,128,128));assert(a.bytes==b.bytes,u.id..' pixels '..n)
  if u.baseId then
   local weapon,grip,forearm,shield,offhand
   for _,layer in ipairs(s.layers)do
    if layer.name=='Attack weapon'then weapon=layer elseif layer.name=='Attack grip'then grip=layer
    elseif layer.name=='Attack forearm'then forearm=layer elseif layer.name=='Shield'then shield=layer
    elseif layer.name=='Offhand'then offhand=layer end
   end
   assert(weapon and grip and forearm and forearm.stackIndex>shield.stackIndex and weapon.stackIndex>shield.stackIndex and weapon.stackIndex>offhand.stackIndex and grip.stackIndex>weapon.stackIndex,u.id..' attack layer order')
   local wc,gc=weapon:cel(n),grip:cel(n)
   if wc then
    local visible=0
    for pixel in wc.image:pixels()do if app.pixelColor.rgbaA(pixel())>0 then
     local x,y=pixel.x+wc.position.x,pixel.y+wc.position.y
     local covered=gc and x>=gc.position.x and y>=gc.position.y and x<gc.position.x+gc.image.width and y<gc.position.y+gc.image.height and app.pixelColor.rgbaA(gc.image:getPixel(x-gc.position.x,y-gc.position.y))>0
     if not covered then assert(a:getPixel(x,y)==pixel(),u.id..' hidden attack weapon '..n);visible=visible+1 end
    end end
    assert(visible>0,u.id..' invisible attack '..n)
    result.attackFramesVerified=result.attackFramesVerified+1
   end
  end
  assert(math.abs(s.frames[n].duration*1000-f.duration)<.1,u.id..' timing '..n)
  for _,edge in ipairs({0,1,126,127})do for c=0,127 do assert(app.pixelColor.rgbaA(a:getPixel(edge,c))==0 and app.pixelColor.rgbaA(a:getPixel(c,edge))==0,u.id..' canvas edge '..n)end end
  if cfg.helmet then for _,layer in ipairs(s.layers)do if layer.name=='Hair'or layer.name=='Hair behind'then assert(not layer:cel(n),u.id..' hair under helmet')end end end
  if f.anchors then for _,anchor in pairs(f.anchors)do assert(anchor.x>=0 and anchor.x<128 and anchor.y>=0 and anchor.y<128,u.id..' invalid anchor')end end
  result.frames=result.frames+1
 end
 if (u.baseId or u.id)=='retiarius'then
  local releases=0;for _,e in ipairs(meta.meta.events)do if e.event=='spawn_net'then
   assert(e.anchor=='left_hand'and meta.frames[e.frame+1].anchors.left_hand)
   releases=releases+1
  end end;assert(releases==4,u.id..' four net release events')
 end
 if u.baseId then
  local byTag={};for _,t in ipairs(meta.meta.frameTags)do byTag[t.name]=t end
  local function render(f)local a=Image(128,128);a:drawSprite(s,f+1);return a.bytes end
  for _,dir in ipairs({'front','rear','right','left'})do
   local idle=render(byTag[dir..'_Idle'].from)
   for _,action in ipairs({'Attack','Hit','Dodge'})do
    local t=byTag[dir..'_'..action]
    assert(render(t.from)==idle and render(t.to)==idle,u.id..' neutral endpoints '..t.name)
   end
   local b=byTag[dir..'_Block'];local bh=byTag[dir..'_BlockHit']
   local attack=byTag[dir..'_Attack']
   for _,layer in ipairs(s.layers)do if layer.name=='Attack weapon'then
    assert(layer:cel(attack.from+5)and layer:cel(attack.from+6),u.id..' missing active strike '..dir)
   end end
   assert(render(b.to)==render(bh.from)and render(b.to)==render(bh.to),u.id..' block continuity '..dir)
   if dir=='left'or dir=='right'then for _,action in ipairs({'Walk','Charge'})do
    local t=byTag[dir..'_'..action]
    for f=t.from+1,t.to do local prev,cur=meta.frames[f],meta.frames[f+1]
     for _,foot in ipairs({'near','far'})do if prev.footContacts[foot]and cur.footContacts[foot]then
      local drift=cur.anchors[foot..'_foot'].x-prev.anchors[foot..'_foot'].x+prev.rootMotion.x
      assert(math.abs(drift)<=1.01,u.id..' planted foot drift '..dir..' '..action)
     end end
    end
   end end
  end
  for _,mode in ipairs({'directional','netless'})do if u[mode]then
   for _,layer in ipairs(s.layers)do if layer.name=='Far held net'or layer.name=='Near held net'then layer.isVisible=mode~='netless'end end
   for dir,export in pairs(u[mode])do
    local m=read(root..'/'..export.data);local img=Image{fromFile=root..'/'..export.image}
    assert(img.width<=2048 and img.height<=2048,u.id..' directional max size')
    local offset=m.meta.sourceFrameOffset
    for i,f in ipairs(m.frames)do
     local a=Image(128,128);a:drawSprite(s,offset+i)
     local b=Image(img,Rectangle(f.frame.x,f.frame.y,128,128))
     assert(a.bytes==b.bytes,u.id..' '..mode..' '..dir..' pixels '..i)
     assert(f.duration==meta.frames[offset+i].duration)
     result.directionalFrames=result.directionalFrames+1
    end
    for _,t in ipairs(m.meta.frameTags)do local original=byTag[t.name];assert(t.from+offset==original.from and t.to+offset==original.to)end
    for _,e in ipairs(m.meta.events)do assert(e.frame>=0 and e.frame<#m.frames and byTag[e.tag])end
    result.directionalSheets=result.directionalSheets+1
   end
  end end
 end
 result.sources=result.sources+1;result.clips=result.clips+#s.tags;s:close()
 print('PASS '..u.id)
end
local f=assert(io.open(root..'/NATIVE_VALIDATION.json','w'));f:write(json.encode(result));f:close()
print('PASS ALL '..result.sources..' sources / '..result.frames..' frames / '..result.clips..' clips')
