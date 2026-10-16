-- Native Aseprite cel drawing. Concatenated after the approved anatomy renderer.
local function color(h)return rgba(tonumber(h:sub(1,2),16),tonumber(h:sub(3,4),16),tonumber(h:sub(5,6),16),255)end
for k,h in pairs({ink='262e30',bronze0='514335',bronze1='8b6a43',bronze2='bd965d',bronze3='e0bd7c',iron0='303b3d',iron1='596c6d',iron2='91a09a',iron3='ccd1b5',red0='462e30',red1='743e39',red2='a75745',red3='cc7a59',leather0='352e29',leather1='594536',leather2='887052',leather3='b79a70',bone0='756e57',bone1='a89b76',bone2='d0c19a',bone3='e5d7b1'})do C[k]=color(h)end
local function ellipse(x,y,rx,ry,c)
 for yy=-ry,ry do for xx=-rx,rx do if xx*xx/(rx*rx)+yy*yy/(ry*ry)<=1 then pixel(x+xx,y+yy,c)end end end
end
local function seg(x,y,u,v,w,c,lit)
 local vx,vy=u-x,v-y;local len=math.max(.1,math.sqrt(vx*vx+vy*vy));local nx,ny=-vy/len*w/2,vx/len*w/2
 shape({x+nx,y+ny,u+nx,v+ny,u-nx,v-ny,x-nx,y-ny},c,'leather0');if lit then line(x-nx+1,y-ny,u-nx+1,v-ny,lit)end
end
local units={
 {id='freed_rebel',name='FREED REBEL',role='IMPROVISED SPEAR',hair='tousled',hairColor=2,cloth='bone'},
 {id='retiarius',name='RETIARIUS',role='TRIDENT AND NET',hair='tied_back',hairColor=1,cloth='red'},
 {id='thraex',name='THRAEX',role='SICA AND SMALL SHIELD',helmet=true,cloth='bone'},
 {id='murmillo',name='MURMILLO',role='GLADIUS AND HEAVY SHIELD',helmet=true,cloth='red'},
 {id='secutor',name='SECUTOR',role='CLOSED HELM AND SCUTUM',helmet=true,cloth='bone'},
 {id='rebel_champion',name='REBEL CHAMPION',role='SPARTACUS INSPIRED LEADER',hair='swept_back',hairColor=2,cloth='red'}
}
local function sandals(rear)
 -- Approved feet remain intact; thin straps wrap the instep rather than extending toes.
 nativeHead=true
 for _,p in ipairs({{55,106},{69,108}})do
  local x,y=p[1],p[2];line(x-2,y-2,x+1,y-1,'leather0');line(x-2,y-3,x+1,y-2,'leather2')
  line(x-2,y,x+2,y+1,'leather1');line(x-1,y+2,x+3,y+2,'leather0')
 end
 nativeHead=false
end
local function skirt(v,rear)
 local p=v.cloth
 shape({53,73,59,74,69,73,72,78,72,87,68,89,64,86,61,89,56,86,52,87,51,80},p..'1')
 poly({54,77,60,78,59,85,56,84,53,85},p..'2');poly({62,78,68,76,69,85,65,84,63,87},p..'2')
 line(55,78,54,83,p..'3');line(62,79,61,84,p..'0');line(70,78,70,85,p..'0')
 seg(53,74,70,74,4,'leather1','leather3')
 if not rear then shape({61,72,65,72,65,76,61,76},'bronze1','bronze0');pixel(62,73,'bronze3')end
end
local function straps(v,rear)
 if v.id=='freed_rebel' then
  shape({51,43,56,43,62,52,70,58,71,69,67,73,65,59,58,51},'bone1')
  line(53,44,61,54,'bone3');line(63,56,68,59,'bone2');line(68,63,69,69,'bone0')
 elseif v.id=='rebel_champion' then
  seg(52,44,70,70,4,'leather1','leather3')
  shape({69,43,75,44,80,48,80,53,74,56,68,52,67,47},'iron0')
  poly({70,44,75,46,78,49,77,52,71,52,69,49},'iron1');line(70,45,75,47,'iron3')
  for y=48,52,2 do line(71,y,76,y+1,'iron2')end
  shape({51,69,58,71,69,68,72,70,69,76,60,77,52,74},'red1')
  line(53,71,61,73,'red3');line(61,74,69,71,'red2')
  shape({53,74,58,76,55,90,49,94,50,83},'red1');line(54,78,52,89,'red2')
 elseif v.id=='retiarius' then
  seg(51,44,70,67,2,'leather1','leather3');seg(52,66,70,47,2,'leather1','leather2')
 else
  seg(51,46,66,70,2,'leather1','leather2')
  if rear then seg(70,45,54,68,2,'leather1','leather2')end
 end
end
local function greaves(v,rear)
 if v.id=='thraex' or v.id=='murmillo' or v.id=='secutor' then
  local near,far=v.near,v.far
  local list=v.id=='thraex' and {{far[1],far[2],far[3],far[4]},{near[1],near[2],near[3],near[4]}} or {{near[1],near[2],near[3],near[4]}}
  for _,p in ipairs(list)do local x,y,a,b=table.unpack(p)
   shape({x-3,y-3,x+2,y-3,x+3,y+1,a+2,b-1,a-2,b,a-3,b-4},'bronze0')
   poly({x-2,y-2,x+1,y-2,x+1,y+2,a+1,b-2,a-1,b-2},rear and 'leather1' or 'bronze1')
   if rear then line(x-2,y+1,x+2,y+1,'bone1');line(a-2,b-4,a+1,b-4,'bone1')
   else line(x-1,y-1,a,b-3,'bronze3');line(x+1,y+2,a+1,b-3,'bronze2')end
  end
 elseif v.id=='rebel_champion' then
  local p=v.near;for t=0,1,.25 do local x=p[1]+(p[3]-p[1])*t;local y=p[2]+(p[4]-p[2])*t;line(x-2,y,x+2,y+1,'bone0');line(x-2,y,x+1,y,'bone2')end
 end
end
local function manica(v,rear)
 if v.id=='freed_rebel' then
  local x,y=rear and 48 or 42,rear and 57 or 64
  seg(x-2,y-2,x+2,y-1,3,'iron0','iron2')
  ellipse(x,y+2,1,2,'iron2');pixel(x-1,y+5,'iron1');pixel(x-3,y+6,'iron2');return
 end
 local p=v.id=='retiarius' and 'bronze' or 'bone'
 if rear then
  shape({47,45,51,45,53,48,49,54,50,57,47,60,43,58,43,54,44,49},p..'0')
  poly({47,48,50,47,50,50,46,54,47,57,45,57,45,52},p..'1')
  for y=49,55,3 do line(45,y,49,y+1,p..'2');pixel(45,y,p..'3')end
 else
  shape({47,45,51,44,53,48,49,54,48,60,45,65,40,63,42,57,43,50},p..'0')
  poly({46,48,49,47,50,49,46,55,46,59,43,62,42,61,44,56},p..'1')
  for y=49,60,3 do local x=47-(y-49)*.32;line(x-2,y,x+1,y+1,p..'2');pixel(x-2,y,p..'3')end
 end
 if v.id=='retiarius' then
  shape({48,46,48,38,51,34,55,36,55,46,52,49},'bronze0')
  poly({50,39,52,36,53,38,53,45,50,46},'bronze1');line(50,39,50,45,'bronze3')
 else
  seg(45,56,48,57,2,'leather1','leather2')
 end
end
local function helmet(v,rear)
 nativeHead=true
 local smooth=v.id=='secutor'
 shape({55,26,56,21,59,18,64,16,69,18,72,22,73,28,72,34,67,38,59,36,55,32},'bronze0')
 poly({57,25,58,21,62,18,66,18,69,21,70,26,68,31,61,34,57,31},'bronze1')
 poly({58,23,61,19,64,18,65,22,62,25,58,26},'bronze2');line(59,21,63,18,'bronze3')
 if rear then
  shape({55,30,71,30,73,34,70,37,59,37,54,34},'bronze0')
  poly({57,31,69,31,71,34,68,35,59,35},'bronze1');line(57,31,69,31,'bronze2')
  line(64,20,65,30,'bronze2')
 elseif smooth then
  poly({64,24,70,24,72,29,69,34,64,35,61,31},'bronze1')
  pixel(63,27,'ink');pixel(64,27,'ink');pixel(68,27,'ink');pixel(69,27,'ink')
  line(66,28,66,31,'bronze3');line(63,33,68,33,'bronze0')
 else
  shape({54,25,72,25,75,28,71,30,55,29,52,27},'bronze1','bronze0');line(54,26,72,26,'bronze3')
  poly({59,29,70,29,71,32,68,35,61,35,58,32},'bronze0')
  for y=30,34,2 do for x=60,69,2 do pixel(x,y,'bronze2')end end
  line(65,29,65,35,'bronze1')
 end
 if smooth then
  shape({61,17,62,14,64,13,67,17,67,20,64,19},'bronze1','bronze0');pixel(63,15,'bronze3')
 elseif v.id=='murmillo' then
  shape({59,18,58,15,60,10,64,8,68,10,69,14,68,20,65,21,64,15,62,15,62,20},'bronze1','bronze0')
  line(60,14,63,10,'bronze3');line(64,10,67,12,'bronze2');line(61,16,64,13,'bronze2')
 else
  shape({57,20,55,17,56,11,61,7,66,7,71,12,72,18,69,21,67,15,62,12,59,15,60,19},'red0')
  poly({57,16,58,12,61,9,66,9,69,12,70,16,67,13,62,11,59,14},'red2')
  line(58,12,61,10,'red3');line(65,9,69,13,'red3')
  seg(61,16,65,19,2,'bronze1','bronze3')
 end
 nativeHead=false
end
local function shield(v,rear)
 if v.id~='thraex' and v.id~='murmillo' and v.id~='secutor' then return end
 local small=v.id=='thraex';local x=rear and 80 or 80;local y=small and 62 or 66
 local w=small and 10 or 13;local h=small and 12 or 22
 -- Rear arm and shield recede on the far side: body occludes the inside edge.
 if rear then x=73;w=small and 7 or 9 end
 shape({x-w,y-h+3,x-w+3,y-h,x+w-3,y-h,x+w,y-h+3,x+w,y+h-3,x+w-3,y+h,x-w+3,y+h,x-w,y+h-3},'bronze0')
 shape({x-w+1,y-h+3,x-w+3,y-h+1,x+w-3,y-h+1,x+w-1,y-h+3,x+w-1,y+h-3,x+w-3,y+h-1,x-w+3,y+h-1,x-w+1,y+h-3},'bronze2','bronze1')
 local p=rear and 'leather' or v.id=='secutor' and 'bone' or 'red'
 poly({x-w+3,y-h+4,x+w-3,y-h+3,x+w-3,y+h-3,x-w+3,y+h-4},p..'1')
 line(x-w+3,y-h+4,x-w+3,y+h-4,p..'2')
 if rear then
  for u=x-w+4,x+w-4,3 do line(u,y-h+4,u,y+h-4,'leather0')end
  seg(x-5,y,x+5,y,3,'leather0','leather3')
 else
  -- Broken chain motif, in contrast with the Roman eagle/lightning shield.
  for _,d in ipairs({-8,8})do
   shape({x-3,y+d-3,x+1,y+d-3,x+3,y+d,x+1,y+d+3,x-3,y+d+3,x-4,y+d},p..'1','bone2')
  end
  line(x-1,y-4,x+2,y-2,'bone2');line(x-3,y+3,x,y+5,'bone2')
  ellipse(x,y,4,4,'bronze0');ellipse(x-1,y-1,3,3,'bronze1');pixel(x-2,y-2,'bronze3')
  line(x+w-5,y+h-9,x+w-3,y+h-11,'bone2');line(x-w+4,y+5,x-w+6,y+7,p..'0')
 end
end
local function weapon(v,rear)
 local originalPoint=point
 local bx,by=rear and 48 or 42,rear and 57 or 64
 local tx,ty=v.grip[1],v.grip[2];local a=math.rad(v.weaponAngle or 0)
 point=function(x,y)
  if raster then return originalPoint(x,y)end
  local u,w=x-bx,y-by
  return originalPoint(tx+u*math.cos(a)-w*math.sin(a),ty+u*math.sin(a)+w*math.cos(a))
 end
 local x,y=rear and 48 or 42,rear and 57 or 64
 if v.id=='freed_rebel' or v.id=='retiarius' then
  seg(x,y+31,x+1,y-37,2,'leather1','leather3')
  if v.id=='retiarius' then
   local yy=y-38;seg(x-6,yy+1,x+7,yy+1,2,'iron1','iron2')
   for _,u in ipairs({-6,1,7})do
    seg(x+u,yy+1,x+u,yy-10,2,'iron1','iron2');shape({x+u-1,yy-10,x+u,yy-14,x+u+2,yy-10},'iron2','iron0')
   end
  else
   shape({x-2,y-35,x+1,y-45,x+4,y-35,x+1,y-31},'iron1','iron0');line(x+1,y-40,x+1,y-34,'iron3')
   for yy=y-32,y-26,2 do line(x-1,yy,x+3,yy,'bone1')end
  end
 elseif v.id=='thraex' then
  seg(x-1,y+5,x+1,y-2,3,'leather1','bronze2');seg(x-3,y-2,x+5,y,2,'bronze1','bronze3')
  shape({x,y-3,x+3,y-12,x+9,y-18,x+16,y-22,x+14,y-17,x+8,y-11,x+4,y-2},'iron1','iron0')
  line(x+3,y-4,x+7,y-12,'iron3');line(x+7,y-12,x+14,y-19,'iron3')
 else
  seg(x,y+5,x,y-2,3,'leather1','bronze2');seg(x-5,y-2,x+5,y-2,2,'bronze1','bronze3')
  shape({x-2,y-4,x-2,y-24,x,y-29,x+2,y-25,x+2,y-4},'iron1','iron0');line(x,y-5,x,y-25,'iron3')
 end
 point=originalPoint
end
local function net(rear,f)
 local x=rear and 78 or 86;local y=64
 local p={x-3,y,x+3,y+3,x+10,y+14,x+10,y+25,x+4,y+30,x-4,y+27,x-8,y+15}
 -- Open diamond mesh. Transparent gaps reveal the ground behind the net.
 for k=-2,3 do
  line(x-6,y+8+k*4,x+8,y+18+k*3,'leather1')
  line(x-5+k*3,y+5,x-9+k*3,y+24,'bone1')
 end
 for i=1,#p,2 do local n=i+2;if n>#p then n=1 end;line(p[i],p[i+1],p[n],p[n+1],'bone2')end
 for _,a in ipairs({{-4,27},{4,30},{10,25}})do ellipse(x+a[1],y+a[2],1,1,'iron2')end
 line(x-3,y,x-6,y-2,'bone2')
end

local originalManica=manica
manica=function(v,rear)
 if v.clip=='Idle' then originalManica(v,rear);return end
 local a=v.weaponArm;local p=v.id=='retiarius' and 'bronze' or 'bone'
 if v.id=='freed_rebel' then
  seg(a[5]-2,a[6]-3,a[5]+2,a[6]-2,3,'iron0','iron2');return
 end
 seg(a[1],a[2],a[3],a[4],6,p..'0',p..'2')
 seg(a[3],a[4],a[5],a[6]-2,5,p..'0',p..'1')
 for t=.15,.9,.25 do
  local x=a[1]+(a[3]-a[1])*t;local y=a[2]+(a[4]-a[2])*t
  line(x-2,y-1,x+2,y+1,p..'2')
 end
 if v.id=='retiarius' then
  shape({48,46,48,38,51,34,55,36,55,46,52,49},'bronze0')
  poly({50,39,52,36,53,38,53,45,50,46},'bronze1');line(50,39,50,45,'bronze3')
 end
end
