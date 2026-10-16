-- Native, pose-aware foot and shoulder drawings. Head/face/hair are untouched.
return function(g)
 local poly,shape,line,pixel,limb=g.poly,g.shape,g.line,g.pixel,g.limb
 local clip,frame='Idle',1
 local function foot(ax,ay,tx,ty,far,rear)
  local x,y=g.native(ax,ay);local _,ground=g.native(tx,ty+1.3)
  local pitch=0
  if clip=='Charge' then
   local phase=(frame-1+(far and 4 or 0))%8+1
   pitch=({-15,8,30,32,22,-5,-18,-25})[phase]
  elseif clip=='Walk' then
   local phase=(frame-1+(far and 4 or 0))%8+1
   pitch=({-13,0,0,20,24,12,-5,-16})[phase]
  elseif clip=='Death' then pitch=10 end
  -- Draw the anatomy at final pixel scale; the foot is not vertically stretched.
  local a=math.rad(pitch);local cx,cy=x,ground-2
  local function pts(p)
   local q={};for i=1,#p,2 do local xx,yy=p[i],p[i+1];q[i]=cx+xx*math.cos(a)-yy*math.sin(a);q[i+1]=cy+xx*math.sin(a)+yy*math.cos(a)end;return q
  end
  g.withNative(function()
   local reach=rear and 3.7 or 5.1
   -- Heel cup, raised instep and a short rounded toe; sole rests on the floor.
   shape(pts({-1.6,-4.6,1.0,-4.6,1.2,-2.8,2.6,-1.1,reach-1,-.5,reach,.3,reach,.9,reach-1,1.5,1.1,1.4,-.4,.8,-1.4,1.5,-2.3,1.1,-2.7,.2,-2.4,-2.2}),far and 'mid' or 'skin','shade')
   poly(pts({-.8,-3.8,.4,-3.6,.7,-2.1,2.0,-.7,reach-1,.2,reach-1,.7,1.1,.3,-.6,-.3,-1.4,.5,-1.8,-.7}),far and 'skin' or 'light')
   -- Connect the ankle over the old shin end without a horizontal seam.
   poly({x-1.2,y-1.6,x+1.0,y-1.6,cx+1,cy-2.1,cx-1.5,cy-1.6},far and 'mid' or 'skin')
   if rear then
    poly(pts({-1.4,-2.3,.3,-2.1,1,.2,.3,.8,-1.1,.7,-1.9,-.2}),far and 'skin' or 'light')
    local p=pts({-.8,-3.3,-.5,-1.3});line(p[1],p[2],p[3],p[4],far and 'mid' or 'skin')
   else
    local p=pts({1.9,.4,3.2,.7});line(p[1],p[2],p[3],p[4],far and 'mid' or 'skin')
    local t=pts({reach-1,.4});pixel(t[1],t[2],far and 'skin' or 'shine')
   end
  end)
 end
 local function leg(hx,hy,p,far,rear)
  local kx,ky,ax,ay,tx,ty=table.unpack(p)
  limb(hx,hy,kx,ky,4.5,5,2.7,far)
  limb(kx,ky,ax,ay,2.8,3.7,1.5,far)
  if not rear then
   poly({kx-2,ky-2,kx+1,ky-2,kx+2,ky,kx,ky+2,kx-2,ky+1},far and 'skin' or 'light')
   line(kx-1,ky+3,ax-1,ay-2,far and 'mid' or 'light')
  else
   poly({kx-2,ky-2,kx+1,ky-1,kx+2,ky+1,kx-1,ky+2},far and 'shade' or 'mid');line(ax,ay-4,ax,ay-1,'light')
  end
  foot(ax,ay,tx,ty,far,rear)
 end
 local function arm(sx,sy,ex,ey,hx,hy,far,rear)
  sx,sy=g.native(sx,sy);ex,ey=g.native(ex,ey);hx,hy=g.native(hx,hy)
  sx=sx+(far and -.3 or 1.0)
  g.withNative(function()
   local vx,vy=ex-sx,ey-sy;local len=math.max(1,math.sqrt(vx*vx+vy*vy));local nx,ny=-vy/len,vx/len
   local function p(t,w)return sx+vx*t+nx*w,sy+vy*t+ny*w end
   local outline={};for _,tw in ipairs({{0,3.4},{.24,4.0},{.60,3.6},{1,2.2},{1,-2.2},{.60,-2.8},{.24,-3.3},{0,-3.1}})do local x,y=p(tw[1],tw[2]);outline[#outline+1]=x;outline[#outline+1]=y end
   -- No dark proximal cap: the arm and shoulder share one mass.
   poly(outline,'mid')
   local lit={};for _,tw in ipairs({{0,1.1},{.30,2.8},{.70,2.0},{1,1.3},{1,-.3},{.35,-.5},{0,-.8}})do local x,y=p(tw[1],tw[2]);lit[#lit+1]=x;lit[#lit+1]=y end;poly(lit,far and 'mid' or 'skin')
   local side=far and -1 or 1
   local prev
   for _,tw in ipairs({{0,3.4},{.24,4.0},{.60,3.6},{1,2.2}})do local x,y=p(tw[1],tw[2]*side);if prev then line(prev[1],prev[2],x,y,'shade')end;prev={x,y}end
   local ix,iy=p(.48,-side*3);local jx,jy=p(1,-side*2.1);line(ix,iy,jx,jy,'shade')
   -- The forearm retains a firm outer contour, blending through the elbow.
   limb(ex,ey,hx,hy-2.4,2.3,2.9,1.5,far)
   poly({ex-1.8,ey-1.5,ex+1.8,ey-1.4,ex+1.5,ey+2,ex-1.6,ey+1.7},'mid')
   line(ex-.7,ey-1,ex-.7,ey+1.2,far and 'skin' or 'light')
   -- Rounded deltoid, merging medially into chest or upper back.
   local outward=far and 1 or -1
   local function cp(p)local q={};for i=1,#p,2 do q[i]=sx+p[i]*outward;q[i+1]=sy+p[i+1]end;return q end
   poly(cp({-4,-2.7,-1,-3.8,2.0,-3.3,4,-1,4.2,2,3.2,5,1,7,-1.7,6,-2.7,2}), 'mid')
   poly(cp({-3,-2,-.7,-2.9,1.5,-2.3,2.6,-.3,2.2,2.5,.5,4,-1.5,3.5,-2.6,1}),rear and 'skin' or (far and 'skin' or 'light'))
   -- Outline follows only the outside, never cutting across the attachment.
   local curve=cp({-1,-3.8,2,-3.3,4,-1,4.2,2,3.2,5})
   for i=1,#curve-2,2 do line(curve[i],curve[i+1],curve[i+2],curve[i+3],'shade')end
   local crease=cp({-2,5,-1,6.5});line(crease[1],crease[2],crease[3],crease[4],'mid')
   -- Resting hand with a palm and a thumb, still on a separate editable arm cel.
   shape({hx-1.8,hy-2.5,hx+.8,hy-2.4,hx+2.1,hy-.8,hx+1.6,hy+2.8,hx,hy+3.2,hx-1.7,hy+1.5,hx-2.3,hy-.4},far and 'mid' or 'skin','shade')
   line(hx-.8,hy-1.5,hx+.5,hy-1,far and 'skin' or 'light');pixel(hx+1,hy+1,'mid')
  end)
 end
 return {leg=leg,arm=arm,setPose=function(c,f)clip,frame=c,f end}
end
