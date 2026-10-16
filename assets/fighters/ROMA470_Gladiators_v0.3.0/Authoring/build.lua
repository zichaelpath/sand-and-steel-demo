local root=assert(app.params.root)
local rgba=app.pixelColor.rgba
local colors={outline='483b38',deep='694a40',shade='91644f',mid='b58061',skin='cc9972',light='dfb58b',shine='ebc8a0',hair0='302e2b',hair1='494035',hair2='66533e',eye='343b39',linen0='645d50',linen1='928675',linen2='b9aa90',linen3='d2c0a1'}
local C={};for k,h in pairs(colors)do C[k]=rgba(tonumber(h:sub(1,2),16),tonumber(h:sub(3,4),16),tonumber(h:sub(5,6),16),255)end
local im,dx,dy,angle= nil,0,0,0
local nativeHead,raster=false,false
local function point(x,y)
 if raster then return x,y end
 if not nativeHead then
  x=62+(x-62)*.94
  if y<=40 then y=19+(y-22)*.82 elseif y<=80 then y=33.76+(y-40)*.87 else y=68.56+(y-80)*1.36 end
 end
 local a=math.rad(angle);local xx,yy=x-62,y-69
 return math.floor(62+xx*math.cos(a)-yy*math.sin(a)+dx+.5),math.floor(69+xx*math.sin(a)+yy*math.cos(a)+dy+.5)
end
local function pixel(x,y,c)
 x,y=point(x,y);if x>=0 and y>=0 and x<128 and y<128 then im:drawPixel(x,y,C[c] or c)end
end
local function line(x,y,u,v,c)
 x,y=point(x,y);u,v=point(u,v);local odx,ody,oa,orr=dx,dy,angle,raster;dx,dy,angle=0,0,0;raster=true
 local n=math.ceil(math.max(math.abs(u-x),math.abs(v-y),1))
 for t=0,n do pixel(x+(u-x)*t/n,y+(v-y)*t/n,c)end
 dx,dy,angle=odx,ody,oa;raster=orr
end
local function poly(p,c)
 local transformed={};for i=1,#p,2 do transformed[i],transformed[i+1]=point(p[i],p[i+1])end;p=transformed
 local odx,ody,oa,orr=dx,dy,angle,raster;dx,dy,angle=0,0,0;raster=true
 local low,high=128,0;for i=2,#p,2 do low=math.min(low,p[i]);high=math.max(high,p[i])end
 for y=math.floor(low),math.ceil(high)do local xs={};local j=#p-1
  for i=1,#p,2 do local x1,y1,x2,y2=p[i],p[i+1],p[j],p[j+1];if(y1<=y and y2>y)or(y2<=y and y1>y)then xs[#xs+1]=x1+(y-y1)*(x2-x1)/(y2-y1)end;j=i end
  table.sort(xs);for i=1,#xs-1,2 do for x=math.ceil(xs[i]),math.floor(xs[i+1])do pixel(x,y,c)end end
 end
 dx,dy,angle=odx,ody,oa;raster=orr
end
local function shape(p,c,edge)
 poly(p,c);for i=1,#p,2 do local n=i+2;if n>#p then n=1 end;line(p[i],p[i+1],p[n],p[n+1],edge or 'outline')end
end
-- Tapered anatomical segment, with a muscle belly and a narrower joint.
local function limb(x,y,u,v,w1,wm,w2,far)
 local vx,vy=u-x,v-y;local len=math.sqrt(vx*vx+vy*vy);local nx,ny=-vy/len,vx/len
 local mx,my=x+vx*.4,y+vy*.4
 shape({x+nx*w1,y+ny*w1,mx+nx*wm,my+ny*wm,u+nx*w2,v+ny*w2,u-nx*w2,v-ny*w2,mx-nx*wm,my-ny*wm,x-nx*w1,y-ny*w1},far and 'shade' or 'mid')
 poly({x-nx*(w1-1),y-ny*(w1-1),mx-nx*(wm-1),my-ny*(wm-1),u-nx*(w2-1),v-ny*(w2-1),u,v,mx+nx*.5,my+ny*.5,x,y},far and 'mid' or 'skin')
 line(x-nx*(w1-1),y-ny*(w1-1),mx-nx*(wm-1),my-ny*(wm-1),far and 'skin' or 'light')
end
local function leg(hx,hy,p,far,rear)
 local kx,ky,ax,ay,tx,ty=table.unpack(p)
 limb(hx,hy,kx,ky,4.5,5,2.7,far)
 limb(kx,ky,ax,ay,2.8,3.7,1.5,far)
 if not rear then
  poly({kx-2,ky-2,kx+1,ky-2,kx+2,ky,kx,ky+2,kx-2,ky+1},far and 'skin' or 'light')
  line(kx-1,ky+3,ax-1,ay-2,far and 'mid' or 'light')
 else poly({kx-2,ky-2,kx+1,ky-1,kx+2,ky+1,kx-1,ky+2},far and 'shade' or 'mid');line(ax,ay-4,ax,ay-1,'light')end
 shape({ax-2,ay-2,ax+1,ay-2,ax+3,ay,tx+2,ty-1,tx+3,ty+1,tx+1,ty+2,ax-2,ay+2},far and 'shade' or 'mid')
 poly({ax-1,ay-1,ax+1,ay-1,tx+1,ty,tx,ty+1,ax-1,ay+1},far and 'mid' or 'skin')
 line(tx-1,ty,tx+1,ty,far and 'skin' or 'light')
end
local function torso(rear,breath)
 -- Neck, trapezius, deltoid shelf, rib cage, obliques and pelvis.
 shape({59,36,66,36,67,41,72,43,77,47,76,55,72,63,70,69,71,76,68,81,56,81,52,76,54,67,50,58,48,49,51,45,57,42},'mid')
 if rear then
  poly({59,39,64,40,65,45,62,51,55,48,51,49,52,46,58,43},'light')
  poly({53,50,60,49,62,54,59,62,55,63,52,57},'skin')
  poly({65,45,71,45,74,49,72,56,67,62,64,60},'skin')
  poly({58,63,62,59,65,62,67,69,66,75,58,76,56,70},'skin')
  line(63,47,63,60,'shade');line(63,63,63,69,'mid')
  line(54,51,58,56,'mid');line(69,50,66,56,'mid')
  line(56,62,58,68,'light');line(59,72,61,74,'light')
 else
  poly({58,39,62,40,65,39,66,42,63,47,58,44},'skin')
  line(58,40,59,43,'light');line(64,41,64,43,'shade')
  poly({52,47,57,45,62,47,63,52+breath,61,56+breath,54,55+breath,51,52},'skin')
  poly({64,47,69,45,73,47,74,51,70,55+breath,65,55+breath},'skin')
  line(53,47,59,46,'light');line(66,46,71,46,'light')
  poly({54,48,59,48,61,50,60,52,54,52},'light')
  line(55,57+breath,60,58+breath,'shade');line(66,56+breath,70,55+breath,'shade')
  pixel(55,54+breath,'shade');pixel(70,53+breath,'shade')
  poly({58,59,62,60,65,59,67,63,66,70,68,74,57,74,57,68},'skin')
  poly({59,60,61,60,61,66,59,67},'light')
  line(64,60,64,64,'mid');line(60,66,62,66,'mid');pixel(63,70,'shade')
  line(54,63,56,69,'shade');line(70,62,68,68,'shade')
  line(55,72,58,74,'light');line(69,71,67,74,'mid')
 end
 -- Plain subligaculum keeps the anatomy study usable as a character base.
 shape({53,74,58,75,65,76,70,74,71,78,68,84,64,83,62,80,60,83,55,84,52,79},'linen1')
 poly({54,76,60,77,63,79,60,82,56,82,54,80},'linen2')
 poly({64,78,69,76,68,80,66,83,64,81},'linen0')
 line(54,75,60,76,'linen3');line(61,77,67,77,'linen2')
 if not rear then line(62,77,64,80,'linen3');line(64,80,64,82,'linen2')end
end
local appearance=dofile(root..'/Authoring/appearance.lua')({shape=shape,poly=poly,line=line,pixel=pixel})
local function head(rear) nativeHead=true;appearance.head(rear);nativeHead=false end
local function arm(sx,sy,ex,ey,hx,hy,far,rear)
 limb(sx,sy,ex,ey,3.7,4.2,2.4,far)
 limb(ex,ey,hx,hy-2,2.5,3.1,1.6,far)
 -- Continuous elbow mass removes the segmented mannequin seam.
 poly({ex-2,ey-2,ex+2,ey-2,ex+2,ey+2,ex-2,ey+2},far and 'shade' or 'mid')
 line(ex-1,ey-1,ex-1,ey+1,far and 'mid' or 'skin')
 -- Palm and thumb are separate pixel clusters, rather than round mittens.
 shape({hx-2,hy-3,hx+1,hy-3,hx+3,hy-1,hx+2,hy+3,hx,hy+4,hx-2,hy+2,hx-3,hy},far and 'mid' or 'skin')
 line(hx-1,hy-2,hx+1,hy-1,far and 'skin' or 'light');line(hx+2,hy,hx+1,hy+2,'shade')
 pixel(hx-1,hy+2,'mid');pixel(hx,hy+3,'shade')
end
local walk={
 {0,{68,94,75,107,82,110},{55,89,49,99,56,102}},
 {1,{67,95,72,108,79,111},{57,88,53,95,58,99}},
 {0,{63,96,62,107,69,111},{62,87,60,96,65,100}},
 {-1,{59,91,55,103,62,107},{67,91,68,105,75,109}},
 {0,{55,89,49,99,56,102},{68,94,75,107,82,110}},
 {1,{57,88,53,95,58,99},{67,95,72,108,79,111}},
 {0,{62,87,60,96,65,100},{63,96,62,107,69,111}},
 {-1,{67,91,68,105,75,109},{59,91,55,103,62,107}}
}
local fixes=dofile(root..'/Authoring/anatomy-fixes.lua')({
 poly=poly,shape=shape,line=line,pixel=pixel,limb=limb,
 native=function(x,y)
  x=62+(x-62)*.94
  if y<=40 then y=19+(y-22)*.82 elseif y<=80 then y=33.76+(y-40)*.87 else y=68.56+(y-80)*1.36 end
  return x,y
 end,
 withNative=function(fn)local previous=nativeHead;nativeHead=true;fn();nativeHead=previous end
})
leg=fixes.leg;arm=fixes.arm
local originalTorso=torso
torso=function(rear,breath)
 originalTorso(rear,breath)
 -- Remove the old separate torso/arm seam while retaining the rib-cage edge.
 line(48,49,50,57,'mid');line(77,47,76,55,'mid')
end


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

-- v0.2: articulated poses, anatomical equipment depth and native profile drawings.
-- Composed after base.lua and equipment.lua; all pixels are drawn in Aseprite cels.
local dirs={'front','rear','right','left'}
local clips={{'Idle',6,160},{'Walk',8,105},{'Hold',6,150},{'Attack',10,85},
 {'Hit',5,90},{'Death',12,110},{'Charge',10,70},{'Block',6,90},
 {'BlockHit',6,75},{'Dodge',8,80}}
local layerNames={'Far weapon','Far arm','Far protection','Far leg','Near leg','Greaves',
 'Hair behind','Torso','Cloth','Harness','Head','Near arm','Manica','Weapon',
 'Offhand','Shield','Hair','Helmet','Details','Far held net','Near held net',
 'Attack forearm','Attack weapon','Attack grip'}
local skins={
 {'483b38','694a40','91644f','b58061','cc9972','dfb58b','ebc8a0'},
 {'48352f','674435','875b42','a97754','be906a','d4ad84','e8c39a'},
 {'352c2b','48352e','624233','81593f','9a6e4e','b88b64','cfa87e'},
 {'302829','3e2e29','51382d','6b4935','835d42','a07a57','b9936c'}}
local skinKeys={'outline','deep','shade','mid','skin','light','shine'}
local clothPalettes={{'462e30','743e39','a75745','cc7a59'},
 {'263b40','3c6167','66898a','96adaa'}, {'403c2d','686243','96906a','c4ba89'},
 {'393340','5d5068','8c7791','b7a0b4'}}
local function palette(v)
 for i,k in ipairs(skinKeys)do C[k]=color(skins[v.skin or 1][i])end
 local fabric=v.tint and clothPalettes[v.tint]or(v.cloth=='bone'and{'756e57','a89b76','d0c19a','e5d7b1'}or clothPalettes[1])
 for i,h in ipairs(fabric)do C['fabric'..(i-1)]=color(h)end
 for i,h in ipairs(appearance.palettes[v.hairColor or 1].hex)do C['hair'..(i-1)]=color(h)end
end
local function copy(t)local r={};for k,v in pairs(t)do r[k]=v end;return r end
local function mix(a,b,t)return a+(b-a)*t end
local function vals(a,f)return a[math.min(f,#a)]end
local p,part,view
local function nativeXY(x,y)
 x=62+(x-62)*.94
 if y<=40 then y=19+(y-22)*.82 elseif y<=80 then y=33.76+(y-40)*.87 else y=68.56+(y-80)*1.36 end
 return x,y
end
local function upper(x,y)
 local a=math.rad(p.lean);local u,w=x-62,y-73
 return p.x+u*math.cos(a)-w*math.sin(a),p.y+u*math.sin(a)+w*math.cos(a)
end
point=function(x,y)
 if raster then return x,y end
 if not nativeHead then x,y=nativeXY(x,y)end
 if part=='upper' then x,y=upper(x,y)end
 if view=='left' or view=='rear'then x=128-x end
 return math.floor(x+.5),math.floor(y+.5)
end
local function useNative(fn)local old=nativeHead;nativeHead=true;fn();nativeHead=old end
local function bodyPart(which,fn)local old=part;part=which;fn();part=old end
local function jointArm(a,far)
 local sx,sy,ex,ey,hx,hy=table.unpack(a)
 limb(sx,sy,ex,ey,3.2,3.8,2,far);limb(ex,ey,hx,hy,2.2,2.8,1.3,far)
 poly({ex-2,ey-2,ex+2,ey-2,ex+2,ey+2,ex-2,ey+2},far and 'mid'or'skin')
 ellipse(sx,sy,3,4,far and'mid'or'skin');line(sx-1,sy-2,sx-2,sy+1,far and'skin'or'light')
 shape({hx-2,hy-2,hx+1,hy-2,hx+2,hy,hx+1,hy+3,hx-1,hy+3,hx-2,hy+1},far and'mid'or'skin','shade')
 pixel(hx,hy-1,'light')
end
local function foot(x,y,far,pitch)
 local a=math.rad(pitch or 0)
 local function q(t)local r={};for i=1,#t,2 do r[i]=x+t[i]*math.cos(a)-t[i+1]*math.sin(a);r[i+1]=y+t[i]*math.sin(a)+t[i+1]*math.cos(a)end;return r end
 shape(q({-2,-5,1,-5,2,-2,5,-1,6,1,5,2,1,2,-1,1,-3,1,-3,-1}),far and'mid'or'skin','shade')
 poly(q({-1,-4,0,-4,1,-1,4,0,4,1,0,0,-2,0}),far and'skin'or'light')
 local s=q({-2,-2,2,0});line(s[1],s[2],s[3],s[4],'leather0')
 local t=q({-2,-3,1,-1});line(t[1],t[2],t[3],t[4],'leather2')
end
local function drawLeg(a,far)
 local hx,hy,kx,ky,ax,ay,pitch=table.unpack(a)
 limb(hx,hy,kx,ky,3.8,4.5,2.4,far);limb(kx,ky,ax,ay-3,2.5,3.3,1.25,far)
 ellipse(kx,ky,2,2,far and'mid'or'skin');line(kx-1,ky+3,ax-1,ay-4,far and'skin'or'light')
 foot(ax,ay,far,pitch)
end
local function protection(v,a)
 if not v.helmet and v.id~='rebel_champion'then return end
 local _,_,kx,ky,ax,ay=table.unpack(a)
 if v.id=='rebel_champion'then
  for t=.15,.8,.16 do local x=mix(kx,ax,t);local y=mix(ky,ay-4,t);line(x-2,y,x+2,y+1,'bone2')end
 else
  seg(kx,ky,ax,ay-5,5,'bronze0','bronze2');line(kx-1,ky-1,ax-1,ay-7,'bronze3')
  for t=.25,.8,.45 do local x=mix(kx,ax,t);local y=mix(ky,ay-5,t);line(x-2,y,x+2,y+1,'leather1')end
 end
end
local function armGuard(v,a,far)
 local sx,sy,ex,ey,hx,hy=table.unpack(a)
 if v.id=='freed_rebel'then seg(hx-2,hy-3,hx+2,hy-2,3,'iron0','iron2');pixel(hx-2,hy+2,'iron2');return end
 local material=v.id=='retiarius'and'bronze'or'bone'
 seg(sx,sy+2,ex,ey,5,material..'0',material..'2');seg(ex,ey,hx,hy-2,4,material..'0',material..'1')
 for t=.15,.9,.22 do local x=mix(sx,ex,t);local y=mix(sy,ey,t);line(x-2,y,x+2,y+1,material..'2')end
 if v.id=='retiarius'then
  shape({sx-4,sy+1,sx-5,sy-9,sx-3,sy-13,sx+1,sy-12,sx+3,sy-4,sx+2,sy+3},'bronze0')
  line(sx-3,sy-9,sx-2,sy-1,'bronze3')
 end
end
local function drawWeapon(v,x,y,a,drop)
 local oldPoint=point;local rad=math.rad(a);local scale=type(drop)=='number'and drop or(drop and .8 or 1)
 point=function(xx,yy)
  if raster then return oldPoint(xx,yy)end
  local u,w=xx*scale,yy*scale
  return oldPoint(x+u*math.cos(rad)-w*math.sin(rad),y+u*math.sin(rad)+w*math.cos(rad))
 end
 if v.id=='retiarius'or v.id=='freed_rebel'then
  -- Direction measured clockwise from an upright shaft.
  seg(0,23,0,-31,2,'leather1','leather3')
  if v.id=='retiarius'then
   seg(-5,-30,5,-30,2,'iron1','iron2')
   for _,u in ipairs({-5,0,5})do seg(u,-30,u,-38,1.5,'iron1','iron2');shape({u-1,-38,u,-42,u+1,-38},'iron2','iron0')end
  else shape({-2,-30,0,-40,3,-30,0,-27},'iron1','iron0');line(0,-37,0,-30,'iron3')end
 else
  seg(0,4,0,-2,3,'leather1','bronze2');seg(-4,-2,4,-2,2,'bronze1','bronze3')
  if v.id=='thraex'then
   shape({-1,-4,1,-12,7,-19,13,-23,11,-17,5,-11,3,-4},'iron1','iron0');line(2,-6,5,-13,'iron3');line(5,-13,11,-20,'iron3')
  else
   local len=v.id=='rebel_champion'and 29 or 22
   shape({-2,-4,-2,-len,0,-len-4,2,-len,2,-4},'iron1','iron0');line(0,-5,0,-len,'iron3')
  end
 end
 point=oldPoint
end
local function drawShield(v,x,y,face,tilt,profile)
 if not v.helmet then return end
 local oldPoint=point;local a=math.rad(tilt or 0)
 point=function(xx,yy)if raster then return oldPoint(xx,yy)end;local u,w=xx-x,yy-y;return oldPoint(x+u*math.cos(a)-w*math.sin(a),y+u*math.sin(a)+w*math.cos(a))end
 local w=v.id=='thraex'and 9 or 12;local h=v.id=='thraex'and 12 or 20
 if profile then w=face and math.floor(w*.7)or math.floor(w*.42)end
 shape({x-w+2,y-h,x+w-2,y-h,x+w,y-h+3,x+w,y+h-2,x+w-2,y+h,x-w+2,y+h,x-w,y+h-2,x-w,y-h+3},'bronze1','bronze0')
 local mat=face and'fabric'or'leather'
 poly({x-w+2,y-h+2,x+w-2,y-h+2,x+w-2,y+h-2,x-w+2,y+h-2},mat..'1')
 line(x-w+1,y-h+3,x-w+1,y+h-3,'bronze3')
 if face then
  ellipse(x,y,3,3,'bronze0');ellipse(x-1,y-1,2,2,'bronze2');pixel(x-1,y-2,'bronze3')
  for _,dy0 in ipairs({-7,7})do shape({x-2,y+dy0-2,x+1,y+dy0-2,x+2,y+dy0,x,y+dy0+2,x-2,y+dy0+1},mat..'1','bone2')end
 else
  line(x-w+3,y-h+3,x-w+3,y+h-3,'leather0');seg(x-3,y,x+3,y,3,'leather0','leather3')
 end
 point=oldPoint
end
local function mesh(x,y,rx,ry)
 -- Elliptical perimeter and diamond mesh, clipped mathematically before drawing.
 local old
 for i=0,24 do local a=i*math.pi/12;local q={x+math.cos(a)*rx,y+math.sin(a)*ry};if old then line(old[1],old[2],q[1],q[2],'bone2')end;old=q end
 for k=-5,5 do
  local last
  for yy=-ry,ry,1 do local xx=k*4+yy*.65;if xx*xx/(rx*rx)+yy*yy/(ry*ry)<.96 then if last then line(last[1],last[2],x+xx,y+yy,'bone1')end;last={x+xx,y+yy}else last=nil end end
  last=nil
  for yy=-ry,ry,1 do local xx=k*4-yy*.65;if xx*xx/(rx*rx)+yy*yy/(ry*ry)<.96 then if last then line(last[1],last[2],x+xx,y+yy,'leather2')end;last={x+xx,y+yy}else last=nil end end
 end
 for i=0,7 do local a=i*math.pi/4;ellipse(x+math.cos(a)*rx,y+math.sin(a)*ry,1,1,'iron2')end
end
local function profileTorso()
 shape({59,34,65,34,65,39,69,43,71,50,69,57,67,63,69,70,69,77,56,77,55,70,57,62,54,54,54,44,59,40},'mid')
 poly({60,38,63,38,64,42,68,45,69,51,66,55,64,62,65,70,59,72,58,64,60,57,57,50,57,45},'skin')
 line(60,42,64,43,'light');line(66,46,67,51,'light');line(64,57,65,62,'shade');line(61,62,60,68,'light')
end
local function profileHead()
 shape({58,23,61,20,65,20,68,22,68,25,69,27,72,29,70,30,69,30,69,32,66,34,61,33,58,29},'mid')
 poly({62,22,66,22,67,25,66,27,70,29,67,30,68,32,65,33,62,30,61,26},'skin')
 line(64,24,66,24,'light');line(65,26,68,26,'deep');pixel(67,27,'eye');pixel(71,29,'shine');line(67,31,69,31,'deep')
 ellipse(60,28,2,2,'skin');pixel(60,28,'shade')
end
local function profileHelmet(v)
 shape({55,25,57,20,62,17,66,18,70,22,72,27,71,32,67,37,59,35,55,31},'bronze0')
 poly({57,24,60,20,63,19,67,21,69,25,68,31,64,34,58,31},'bronze1')
 line(58,23,62,19,'bronze3');poly({60,22,63,20,64,25,61,27,58,27},'bronze2')
 if v.id=='secutor'then
  pixel(69,27,'ink');line(69,29,70,31,'bronze3');shape({60,18,62,14,64,15,66,19},'bronze1','bronze0')
 else
  seg(55,26,73,27,2,'bronze1','bronze3');shape({65,29,72,29,71,33,67,36,64,34},'bronze0')
  for y=30,34,2 do for x=66,70,2 do pixel(x,y,'bronze2')end end
  if v.id=='thraex'then shape({56,21,54,17,56,11,61,8,67,10,71,15,70,21,67,17,62,13,58,15,59,20},'fabric1','fabric0');line(57,12,61,10,'fabric3');line(62,10,67,13,'fabric2')
  else shape({59,19,58,15,61,9,65,9,69,13,68,20,65,20,64,14,62,15,62,19},'bronze1','bronze0');line(61,13,64,10,'bronze3')end
 end
end
local function profileHair(v,back)
 -- Head profile is independently drawn. Reuse the eight approved hair silhouettes,
 -- adjusted at the crown, with rear hair composited behind the profile neck.
 local old=point
 point=function(x,y)if raster then return old(x,y)end;return old(62+(x-62)*.86,y)end
 if back then appearance.hairBack(v.hair,false)else appearance.hairFront(v.hair,false)end
 point=old
end

local function pose(v,dir,clip,f)
 view=dir;part='world';nativeHead=true;dx,dy,angle=0,0,0
 local rear=dir=='rear';local side=dir=='left'or dir=='right'
 p={x=62,y=73,lean=0,weaponAngle=12,shieldTilt=0,net=true}
 local heavy=v.id=='murmillo'or v.id=='secutor'
 local spear=v.id=='retiarius'or v.id=='freed_rebel'
 local weaponShoulder=side and 62 or 53;local offShoulder=side and 63 or 72
 local a={weaponShoulder,44,49,56,47,64};local off={offShoulder,44,76,55,78,62}
 local near={65,73,69,92,71,111,0};local far={58,73,55,91,53,110,0}
 if side then a={62,44,57,57,64,63};off={63,44,70,55,74,63};near={63,73,68,91,74,111,0};far={61,73,54,92,49,111,0}end
 near[1],far[1]=65,58
 local neutral={a=copy(a),off=copy(off),near=copy(near),far=copy(far)}
 if clip=='Idle'or clip=='Hold'then
  p.y=73+vals({0,0,-1,-1,0,0},f)*.5
  if clip=='Hold'then p.lean=heavy and 4 or 6;p.y=75;a={weaponShoulder,44,48,57,spear and 57 or 61,55};off={offShoulder,44,73,51,75,55};p.weaponAngle=spear and 63 or 22 end
 elseif clip=='Walk'or clip=='Charge'then
  local count=clip=='Charge'and 10 or 8;local t=(f-1)/count*math.pi*2
  local amp=clip=='Charge'and(heavy and 15 or 19)or 12
  local lift=clip=='Charge'and 13 or 7
  p.y=73+(clip=='Charge'and 1 or 0)+math.cos(t*2)*(clip=='Charge'and 1.3 or .8)
  p.lean=clip=='Charge'and(heavy and 9 or 14)+math.sin(t)*2 or 3
  -- Linear backward travel during stance cancels uniform game-world movement.
  -- Swing returns forward with toe clearance; opposite legs are half a cycle apart.
  local function runningLeg(phase,hx)
   local cycle=(phase/(2*math.pi))%1
   local contact=cycle<.5
   local u=contact and cycle*2 or(cycle-.5)*2
   local travel=contact and(1-2*u)or(-1+2*u)
   local fly=contact and 0 or math.sin(u*math.pi)
   local ax=62+travel*amp;local ay=111-fly*lift
   local kx=62+travel*amp*.45+fly*5;local ky=91-fly*(clip=='Charge'and 9 or 5)
   return {hx,p.y,kx,ky,ax,ay,contact and 0 or(-travel*12+fly*18)},contact
  end
  near,p.nearContact=runningLeg(t,side and 63 or 65);far,p.farContact=runningLeg(t+math.pi,side and 61 or 58)
  p.stride=amp*4
  local sw=math.sin(t)*(heavy and 2 or 4)
  a={weaponShoulder,44,48+sw,56,54+sw,58};off={offShoulder,44,74-sw*.5,53,76-sw*.5,58}
  p.weaponAngle=spear and(clip=='Charge'and 62 or 18)or(clip=='Charge'and 25 or 5)
 elseif clip=='Attack'then
  local reach=vals({0,-2,-4,-2,5,9,7,4,1,0},f)
  p.x=62+reach*.45;p.y=vals({74,75,76,75,76,77,76,75,74,73},f)
  p.lean=vals({2,-4,-7,-3,10,16,12,8,4,0},f)
  near={66,p.y,73,92,81,111,0};far={58,p.y,50,91,43,110,5}
  if v.id=='retiarius'then
   -- Long, low thrust: loading, full extension, recovery.
   a={weaponShoulder,44,vals({48,45,43,48,59,64,61,56,51,49},f),54,vals({54,49,44,52,69,73,70,64,57,52},f),vals({56,55,54,52,51,51,52,54,57,60},f)}
   p.weaponAngle=vals({60,54,50,70,84,88,88,76,64,24},f)
   off={offShoulder,44,76,57,78,67}
  elseif v.id=='freed_rebel'then
   a={weaponShoulder,44,vals({48,43,43,48,56,60,57,54,50,49},f),57,vals({51,46,43,52,64,69,66,60,55,49},f),vals({59,62,63,58,55,55,56,59,61,63},f)}
   p.weaponAngle=vals({30,35,40,62,80,84,80,65,40,20},f)
   off={offShoulder,44,65,55,66,60}
  elseif v.id=='thraex'then
   p.lean=vals({2,-7,-10,-2,8,12,8,5,2,0},f)
   a={weaponShoulder,44,vals({48,44,43,47,59,63,59,53,49,48},f),vals({53,48,44,47,53,58,61,59,56,55},f),vals({52,47,44,57,70,74,69,61,54,50},f),vals({52,43,40,46,54,61,66,61,56,59},f)}
   p.weaponAngle=vals({-15,-45,-65,-10,55,95,115,70,30,12},f)
  elseif v.id=='rebel_champion'then
   a={weaponShoulder,44,vals({48,43,43,45,54,60,59,54,49,48},f),vals({54,47,39,37,43,55,62,62,58,56},f),vals({53,47,44,48,63,73,75,67,58,51},f),vals({50,38,31,29,38,58,71,70,61,60},f)}
   p.weaponAngle=vals({-15,-50,-78,-95,-25,55,105,100,45,12},f)
   off={offShoulder,44,77,59,74,71}
  else
   -- Heavy shield stays forward while a compact gladius thrust clears its rim.
   p.lean=vals({2,-1,-3,0,6,9,7,5,2,0},f)
   a={weaponShoulder,44,vals({49,48,47,52,61,65,62,55,51,49},f),55,vals({53,50,48,54,73,77,73,63,55,50},f),vals({59,61,62,58,54,54,55,57,59,61},f)}
   p.weaponAngle=vals({30,24,20,50,80,88,86,60,35,16},f)
   if v.id=='secutor'then
    p.x=p.x+vals({0,0,0,0,1,2,2,1,0,0},f)
    a[6]=a[6]-vals({0,1,2,5,8,8,6,3,1,0},f)
    p.weaponAngle=p.weaponAngle-vals({0,0,0,5,9,7,3,0,0,0},f)
   end
  end
  if v.helmet then off={offShoulder,44,72,51,73,57};p.shieldTilt=-5 end
 elseif clip=='Block'or clip=='BlockHit'then
  local recoil=clip=='BlockHit'and vals({0,-3,-4,-2,-1,0},f)or 0
  p.x=62+recoil;p.y=75-recoil*.25;p.lean=clip=='BlockHit'and vals({6,-4,-7,-2,2,6},f)or 6
  near={66,p.y,74,95,78,111,0};far={58,p.y,52,94,46,111,0}
  off={offShoulder,44,73,49,76+recoil*.2,51};p.shieldTilt=-12
  a={weaponShoulder,44,49,55,58,52};p.weaponAngle=spear and 42 or -18
  if not v.helmet then a={weaponShoulder,44,54,48,67,42};off={offShoulder,44,69,48,61,57};p.weaponAngle=spear and 48 or 62 end
 elseif clip=='Dodge'then
  p.x=vals({62,60,56,51,49,52,57,62},f);p.y=vals({73,76,79,77,74,75,74,73},f);p.lean=vals({0,-5,-13,-16,-9,-4,0,0},f)
  near={p.x+3,p.y,p.x+9,94,vals({72,69,61,51,43,48,61,72},f),vals({111,111,103,99,106,111,111,111},f),0}
  far={p.x-4,p.y,p.x-8,93,vals({52,47,40,35,35,40,47,52},f),vals({111,107,100,107,111,111,111,111},f),8}
  a={weaponShoulder,44,49,53,54,51};off={offShoulder,44,72,50,73,54};p.weaponAngle=spear and 36 or 2
 elseif clip=='Hit'then
  p.x=vals({62,59,57,60,62},f);p.y=vals({73,75,76,74,73},f);p.lean=vals({0,-12,-16,-6,0},f)
  a={weaponShoulder,44,47,57,48,65};off={offShoulder,44,77,56,79,64};p.weaponAngle=-12
 elseif clip=='Death'then
  -- Knee collapse precedes hip descent; torso folds independently, equipment lags.
  p.x=vals({62,61,60,59,57,54,51,49,48,48,48,48},f)
  p.y=vals({73,76,81,88,95,99,102,104,105,105,105,105},f)
  p.lean=vals({0,-7,2,16,35,58,76,87,93,90,90,90},f)
  local kneeX=vals({69,72,76,78,73,66,58,51,48,47,47,47},f)
  local kneeY=vals({92,94,98,104,110,113,113,113,113,113,113,113},f)
  near={p.x+3,p.y,kneeX,kneeY,vals({71,71,69,66,60,51,39,30,25,25,25,25},f),111,0}
  far={p.x-4,p.y,kneeX-8,kneeY-2,vals({52,51,48,44,39,34,28,23,21,21,21,21},f),109,5}
  a={weaponShoulder,44,vals({49,48,50,55,60,65,68,70,70,70,70,70},f),vals({56,57,59,63,66,68,69,71,71,71,71,71},f),vals({47,48,53,61,70,78,79,78,78,78,78,78},f),vals({64,65,68,73,77,79,81,83,83,83,83,83},f)}
  off={offShoulder,44,77,57,80,69};p.weaponAngle=vals({12,5,0,-10,-15,-30,-40,-45,-45,-45,-45,-45},f)
  p.drop=f>=6;p.net=f<6
 elseif clip=='NetCast'then
  p.x=vals({62,60,59,60,64,66,65,63,62,62},f);p.y=vals({73,74,75,74,75,75,75,74,73,73},f);p.lean=vals({0,-5,-9,-3,9,12,9,5,2,0},f)
  a={weaponShoulder,44,49,59,50,66};p.weaponAngle=-8
  off={offShoulder,44,vals({75,74,72,74,82,86,84,80,76,76},f),vals({54,47,41,44,49,52,56,58,57,55},f),vals({78,74,67,78,91,94,91,85,81,78},f),vals({63,49,38,42,49,53,57,61,63,62},f)}
  p.net=f<=5
 end
 -- Shared neutral endpoints eliminate stance/hand teleports when one-shots return.
 local weight
 if clip=='Attack'or clip=='NetCast'then weight=vals({0,.55,1,1,1,1,1,1,.55,0},f)
 elseif clip=='Dodge'then weight=vals({0,.65,1,1,1,1,.65,0},f)
 elseif clip=='Hit'then weight=vals({0,1,1,.7,0},f)
 elseif clip=='Block'then weight=vals({0,.4,.8,1,1,1},f)
 elseif clip=='Death'and f==1 then weight=0 end
 if weight then
  p.x=mix(62,p.x,weight);p.y=mix(73,p.y,weight);p.lean=p.lean*weight
  p.weaponAngle=mix(12,p.weaponAngle,weight);p.shieldTilt=p.shieldTilt*weight
  for _,pair in ipairs({{a,neutral.a},{off,neutral.off},{near,neutral.near},{far,neutral.far}})do
   for i=1,#pair[1]do pair[1][i]=mix(pair[2][i],pair[1][i],weight)end
  end
 end
 if clip~='Walk'and clip~='Charge'and clip~='Death'and clip~='Dodge'then near[1],near[2],far[1],far[2]=p.x+3,p.y,p.x-4,p.y end
 local imgs={};for i=1,#layerNames do imgs[i]=Image(128,128)end
 local function draw(i,fn,which)im=imgs[i];bodyPart(which or'upper',function()useNative(fn)end)end
 draw(4,function()drawLeg(far,true)end,'world');draw(5,function()drawLeg(near,false)end,'world')
 draw(6,function()protection(v,near);if v.id=='thraex'then protection(v,far)end end,'world')
 local weaponFar=dir=='left'or rear;local shieldFar=dir=='right'or rear
 local attackDepth=clip=='Attack'and f>=2 and f<=9
 draw(weaponFar and 2 or 12,function()jointArm(a,weaponFar)end)
 draw(weaponFar and 3 or 13,function()armGuard(v,a,weaponFar)end)
 draw(shieldFar and 2 or 15,function()jointArm(off,shieldFar)end)
 draw(8,function()
  if side then profileTorso()else nativeHead=false;torso(rear,clip=='Idle'and(f==3 or f==4)and 1 or 0);nativeHead=true end
 end)
 draw(9,function()
  local w=side and 8 or 10
  shape({62-w,70,62+w,70,64+w,78,63+w,86,66,84,61,86,57,84,52+(side and 3 or 0),85,51+(side and 3 or 0),77},'fabric1','fabric0')
  line(55,73,54,81,'fabric3');line(62,74,60,83,'fabric0');line(66,74,68,81,'fabric2');seg(62-w,71,62+w,71,3,'leather1','leather3')
  if not rear then shape({62,70,65,70,65,73,62,73},'bronze1','bronze0');pixel(63,71,'bronze3')end
 end)
 draw(10,function()
  if side then
   seg(59,40,66,68,2,'leather1','leather2')
   if v.id=='freed_rebel'then seg(58,42,65,63,4,'bone1','bone3')end
   if v.id=='rebel_champion'then seg(55,67,69,70,4,'fabric1','fabric3')end
  else nativeHead=false;straps(v,rear);nativeHead=true end
 end)
 draw(11,function()if side then profileHead()else appearance.head(rear)end end)
 if v.hair and not v.helmet then
  draw(7,function()if side then profileHair(v,true)else appearance.hairBack(v.hair,rear)end end)
  draw(17,function()if side then profileHair(v,false)else appearance.hairFront(v.hair,rear)end end)
 end
 if v.helmet then draw(18,function()if side then profileHelmet(v)else helmet(v,rear);nativeHead=true end end)end
 if not p.drop then
  draw(attackDepth and 23 or(weaponFar and 1 or 14),function()drawWeapon(v,a[5],a[6],p.weaponAngle)end)
  -- Hand highlights above the grip, without drawing a second arm over equipment.
  draw(attackDepth and 24 or(weaponFar and 3 or 19),function()line(a[5]-1,a[6],a[5]+1,a[6]+1,'light')end)
  draw(shieldFar and 1 or 16,function()
   drawShield(v,off[5],off[6]+1,not rear and dir~='right',p.shieldTilt,side)
  end)
  draw(shieldFar and 20 or 21,function()
   if v.id=='retiarius'and p.net then
    local spread=clip=='NetCast'and vals({0,0,0,3,5,0,0,0,0,0},f)or 0
    mesh(off[5]+3,off[6]+13,6+spread,12);line(off[5],off[6],off[5]+3,off[6]+2,'bone2')
   end
  end)
 else
  -- Equipment leaves the hands after the collapse, then settles over four frames.
  local settle=math.min(1,(f-5)/4)
  draw(14,function()drawWeapon(v,mix(61,74,settle),mix(103,113,settle),mix(20,87,settle),mix(1,.8,settle))end,'world')
  draw(16,function()drawShield(v,mix(74,73,settle),mix(102,108,settle),not rear,mix(35,78,settle),side)end,'world')
  if v.id=='retiarius'then draw(21,function()mesh(mix(82,90,settle),mix(109,115,settle),mix(6,15,settle),mix(8,5,settle))end,'world')end
 end
 if v.id=='rebel_champion'then draw(19,function()
  local sx=side and 62 or 72;shape({sx-4,42,sx,40,sx+5,44,sx+6,48,sx+2,52,sx-4,49},'iron0')
  poly({sx-2,42,sx,42,sx+4,45,sx+3,49,sx-2,48},'iron1');line(sx-1,42,sx+3,44,'iron3')
 end)end
 if attackDepth then
  -- The reaching forearm and weapon cross in front of the shield during the
  -- strike. Keep the upper arm at its anatomical depth; fingers close over grip.
  draw(22,function()
   limb(a[3],a[4],a[5],a[6],2.2,2.8,1.3,weaponFar)
   if v.id~='freed_rebel'then
    local material=v.id=='retiarius'and'bronze'or'bone'
    seg(a[3],a[4],a[5],a[6]-2,4,material..'0',material..'1')
   end
  end)
  draw(24,function()
   shape({a[5]-2,a[6]-2,a[5]+1,a[6]-2,a[5]+2,a[6],a[5]+1,a[6]+3,a[5]-1,a[6]+3,a[5]-2,a[6]+1},weaponFar and'mid'or'skin','shade')
   line(a[5]-1,a[6],a[5]+1,a[6]+1,'light')
  end)
  -- Far-side attacks still pass behind the torso; promoting them must not
  -- produce an X-ray arm through the back. Head/helmet occlusion is preserved.
  local masks=weaponFar and{7,8,9,10,11,17,18,19}or{7,11,17,18}
  -- The attacking forearm, closed grip and sword pass in front of the shield.
  -- Keep only anatomical body/head occlusion on these foreground attack cels.
  for _,idx in ipairs({22,23,24})do
   for pixel in imgs[idx]:pixels()do if app.pixelColor.rgbaA(pixel())>0 then
    for _,mask in ipairs(masks)do if app.pixelColor.rgbaA(imgs[mask]:getPixel(pixel.x,pixel.y))>0 then pixel(0);break end end
   end end
  end
 end
 local wx,wy=upper(a[5],a[6]);local ox,oy=upper(off[5],off[6])
 if dir=='left'or dir=='rear'then wx,ox=128-wx,128-ox end
 local nx,fx=near[5],far[5];if dir=='left'or dir=='rear'then nx,fx=128-nx,128-fx end
 return imgs,{near_foot={x=math.floor(nx+.5),y=math.floor(near[6]+.5)},far_foot={x=math.floor(fx+.5),y=math.floor(far[6]+.5)},right_hand={x=math.floor(wx+.5),y=math.floor(wy+.5)},left_hand={x=math.floor(ox+.5),y=math.floor(oy+.5)},ground={x=64,y=114}},{near=p.nearContact or false,far=p.farContact or false,stride=p.stride}
end

local function write(path,data)local f=assert(io.open(path,'w'));f:write(json.encode(data));f:close()end
local catalog={version='0.3.0',frameSize=128,pixelsPerUnit=72,pivotNormalized={.5,.109375},units={},variants={},effects={}}
local previousCatalog
if app.params.heavyOnly=='yes'then
 local f=assert(io.open(root..'/Characters/catalog.json'));previousCatalog=json.decode(f:read('*a'));f:close()
end
local validation={}
local previousValidation
if previousCatalog then local f=assert(io.open(root..'/validation.json'));previousValidation=json.decode(f:read('*a'));f:close()end
local function export(v,variant)
 palette(v)
 local uid=variant and v.variantId or v.id
 local prefix=variant and'Variants/'or'Characters/'
 local s=Sprite(128,128);s:deleteLayer(s.layers[1]);local layers={}
 for i,name in ipairs(layerNames)do layers[i]=s:newLayer();layers[i].name=name end
 layers[20].stackIndex=2;layers[21].stackIndex=layers[16].stackIndex+1
 local n=0;local meta={frames={},meta={image=uid..'.png',format='RGBA8888',scale='1',frameTags={},events={},version='0.3.0'}}
 local actions={};for _,c in ipairs(clips)do actions[#actions+1]=c end
 if v.id=='retiarius'then actions[#actions+1]={'NetCast',10,85}end
 for _,dir in ipairs(dirs)do for _,c in ipairs(actions)do
  local first=n
  for f=1,c[2]do
   n=n+1;if n>1 then s:newEmptyFrame(n)end
   local ms=c[3]
   if c[1]=='Attack'then ms=vals({100,100,110,70,55,55,75,95,110,120},f)
   elseif c[1]=='Death'and f>=10 then ms=160
   elseif c[1]=='BlockHit'then ms=vals({50,65,95,70,80,110},f)end
   s.frames[n].duration=ms/1000
   local rendered,anchors,contact=pose(v,dir,c[1],f)
   for i,img in ipairs(rendered)do if not img:isEmpty()then s:newCel(layers[i],n,img,Point(0,0))end end
   meta.frames[n]={filename=uid..' '..(n-1),frame={x=((n-1)%8)*128,y=math.floor((n-1)/8)*128,w=128,h=128},rotated=false,trimmed=false,spriteSourceSize={x=0,y=0,w=128,h=128},sourceSize={w=128,h=128},duration=ms,anchors=anchors,footContacts={near=contact.near,far=contact.far},rootMotion=contact.stride and{x=(dir=='left'and -1 or 1)*contact.stride/c[2],y=0,profileOnly=true}or nil}
  end
  local tag={name=dir..'_'..c[1],from=first,to=n-1,direction='forward',loop=c[1]=='Idle'or c[1]=='Walk'or c[1]=='Hold'or c[1]=='Charge'}
  meta.meta.frameTags[#meta.meta.frameTags+1]=tag
  if c[1]=='Walk'or c[1]=='Charge'then tag.motion={stridePixels=4*(c[1]=='Charge'and((v.id=='murmillo'or v.id=='secutor')and 15 or 19)or 12),cycleMs=c[2]*c[3],appliesTo='left/right profiles'}end
  if c[1]=='Dodge'then meta.meta.events[#meta.meta.events+1]={tag=tag.name,frame=first+2,event='dodge_active_start'};meta.meta.events[#meta.meta.events+1]={tag=tag.name,frame=first+5,event='dodge_active_end'}end
  if c[1]=='Attack'then meta.meta.events[#meta.meta.events+1]={tag=tag.name,frame=first+4,event='attack_active_start'};meta.meta.events[#meta.meta.events+1]={tag=tag.name,frame=first+6,event='attack_active_end'}end
  if c[1]=='NetCast'then meta.meta.events[#meta.meta.events+1]={tag=tag.name,frame=first+5,event='spawn_net',effect='net_projectile',anchor='left_hand'}end
 end end
 -- Add tags only after all frames exist: inserting at a tag boundary can extend
 -- earlier tags in Aseprite and silently include frames from the next action.
 for _,t in ipairs(meta.meta.frameTags)do local at=s:newTag(t.from+1,t.to+1);at.name=t.name end
 local rows=math.ceil(n/8);meta.meta.size={w=1024,h=rows*128}
 s.data=json.encode({id=v.id,variant=variant and uid or nil,version='0.3.0',helmet=v.helmet or false,skin=v.skin or 1,hair=v.hair,hairColor=v.hairColor,tint=v.tint or 1,directions=dirs})
 s:saveAs(root..'/'..prefix..'Source/'..uid..'.aseprite')
 local sheet=Image(1024,rows*128);local edge,empty=0,0;local edgeFrames={}
 for f=1,n do
  local img=Image(128,128);img:drawSprite(s,f);sheet:drawImage(img,Point(((f-1)%8)*128,math.floor((f-1)/8)*128))
  if img:isEmpty()then empty=empty+1 end
  local hit=false;for xy in img:pixels()do if app.pixelColor.rgbaA(xy())>0 and(xy.x<2 or xy.y<2 or xy.x>125 or xy.y>125)then edge=edge+1;hit=true end end
  if hit then edgeFrames[#edgeFrames+1]=f end
 end
 sheet:saveAs(root..'/'..prefix..'PNG/'..uid..'.png');write(root..'/'..prefix..'PNG/'..uid..'.json',meta)
 -- Compact per-direction exports are built directly from the native document.
 local directional={};local netless={}
 local function directionSheet(dir,noNet)
  local selected={};local first,last
  for _,tag in ipairs(meta.meta.frameTags)do if tag.name:sub(1,#dir+1)==dir..'_'then selected[#selected+1]=tag;first=first or tag.from;last=tag.to end end
  local name=uid..'_'..dir..(noNet and'_no_net'or'')
  local count=last-first+1;local out=Image(1024,math.ceil(count/8)*128)
  local data={frames={},meta={image=name..'.png',size={w=out.width,h=out.height},frameTags={},events={},version='0.3.0',sourceFrameOffset=first,netEquipped=not noNet}}
  for i=0,count-1 do
   local img=Image(128,128);img:drawSprite(s,first+i+1);out:drawImage(img,Point((i%8)*128,math.floor(i/8)*128))
   local row=copy(meta.frames[first+i+1]);row.frame={x=(i%8)*128,y=math.floor(i/8)*128,w=128,h=128};data.frames[#data.frames+1]=row
  end
  for _,tag in ipairs(selected)do local q=copy(tag);q.from=tag.from-first;q.to=tag.to-first;data.meta.frameTags[#data.meta.frameTags+1]=q end
  for _,e in ipairs(meta.meta.events)do if e.frame>=first and e.frame<=last then local q=copy(e);q.frame=e.frame-first;data.meta.events[#data.meta.events+1]=q end end
  out:saveAs(root..'/Directional/'..name..'.png');write(root..'/Directional/'..name..'.json',data)
  return {image='Directional/'..name..'.png',data='Directional/'..name..'.json'}
 end
 for _,dir in ipairs(dirs)do directional[dir]=directionSheet(dir,false)end
 if v.id=='retiarius'then
  layers[20].isVisible=false;layers[21].isVisible=false
  for _,dir in ipairs(dirs)do netless[dir]=directionSheet(dir,true)end
  layers[20].isVisible=true;layers[21].isVisible=true
 end
 local info={directional=directional,netless=v.id=='retiarius'and netless or nil,id=uid,baseId=v.id,name=v.name,source=prefix..'Source/'..uid..'.aseprite',image=prefix..'PNG/'..uid..'.png',data=prefix..'PNG/'..uid..'.json',directions=dirs,hair=v.hair,hairColor=v.hairColor,skin=v.skin or 1,tint=v.tint or 1}
 table.insert(variant and catalog.variants or catalog.units,info)
 validation[#validation+1]={id=uid,frames=n,tags=#s.tags,empty=empty,edgePixels=edge,edgeFrames=edgeFrames}
 s:close();print('BUILT '..uid..' '..n..' frames / bounds '..edge)
end
local function selected(v)return(not app.params.only or app.params.only==v.id)and(app.params.heavyOnly~='yes'or v.id=='murmillo'or v.id=='secutor')end
for _,v in ipairs(units)do if selected(v)then export(v,false)end end
if not app.params.only and app.params.variants~='no'then
 -- Four ready-composited appearances per type; exposed heads cover all 8 styles.
 local styles={{'tousled','caesar','short_curls','shoulder_length'},{'tied_back','close_crop','side_part','swept_back'},{},{},{},{'swept_back','short_curls','tied_back','caesar'}}
 for u,v in ipairs(units)do for i=1,4 do
  local a=copy(v);a.skin=i;a.tint=i;a.hairColor=i
  if not a.helmet then a.hair=styles[u][i]end
  a.variantId=v.id..'_appearance_'..i;a.name=v.name..' / APPEARANCE '..i
  if selected(a)then export(a,true)end
 end end
end
-- Reusable transparent net sprites, authored independently of any character sheet.
if not app.params.only and app.params.heavyOnly~='yes'then
 for _,effect in ipairs({'net_projectile','net_landed'})do
  local s=Sprite(128,128);s.layers[1].name='Weighted mesh';local meta={frames={},meta={image=effect..'.png',size={w=1024,h=128},frameTags={{name=effect,from=0,to=7,direction='forward',loop=false}}}}
  for f=1,8 do
   im=Image(128,128);part='world';nativeHead=true;view='front'
   if effect=='net_projectile'then mesh(64,64,vals({10,16,23,28,31,32,32,32},f),vals({18,22,23,22,20,19,19,19},f))
   else mesh(64,80,vals({22,28,31,32,31,31,31,31},f),vals({19,15,11,9,10,10,10,10},f))end
   if f>1 then s:newEmptyFrame(f)end;s.frames[f].duration=.08;s:newCel(s.layers[1],f,im,Point(0,0))
   meta.frames[f]={filename=effect..' '..(f-1),frame={x=(f-1)*128,y=0,w=128,h=128},duration=80,sourceSize={w=128,h=128},spriteSourceSize={x=0,y=0,w=128,h=128},trimmed=false,rotated=false}
  end
  local t=s:newTag(1,8);t.name=effect;s:saveAs(root..'/Effects/Source/'..effect..'.aseprite')
  local sheet=Image(1024,128);for f=1,8 do local a=Image(128,128);a:drawSprite(s,f);sheet:drawImage(a,Point((f-1)*128,0))end
  sheet:saveAs(root..'/Effects/PNG/'..effect..'.png');write(root..'/Effects/PNG/'..effect..'.json',meta)
  catalog.effects[#catalog.effects+1]={id=effect,name=effect,source='Effects/Source/'..effect..'.aseprite',image='Effects/PNG/'..effect..'.png',data='Effects/PNG/'..effect..'.json'};s:close()
 end
end
if previousCatalog then
 for _,group in ipairs({'units','variants'})do for i,u in ipairs(previousCatalog[group])do
  for _,fresh in ipairs(catalog[group])do if fresh.id==u.id then previousCatalog[group][i]=fresh end end
 end end
 catalog=previousCatalog
 for i,u in ipairs(previousValidation)do for _,fresh in ipairs(validation)do if u.id==fresh.id then previousValidation[i]=fresh end end end
 validation=previousValidation
end
write(root..'/Characters/catalog.json',catalog);write(root..'/validation.json',validation)
