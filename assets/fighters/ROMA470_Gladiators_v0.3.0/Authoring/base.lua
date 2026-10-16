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

