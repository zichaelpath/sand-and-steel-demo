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
