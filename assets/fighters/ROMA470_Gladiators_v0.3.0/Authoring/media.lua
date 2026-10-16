local root=assert(app.params.root);local release=assert(app.params.release)
local function read(p)local f=assert(io.open(p));local t=json.decode(f:read('*a'));f:close();return t end
local cat=read(root..'/Characters/catalog.json');local sources={}
local rgba=app.pixelColor.rgba
local bg=rgba(17,29,32,255);local panel=rgba(29,45,46,255);local gold=rgba(198,163,107,255);local ivory=rgba(231,222,197,255)
local text=dofile(root..'/Authoring/font.lua')
local function label(im,x,y,str,scale)
 local a=Image(#str*6+2,8);text(a,0,0,str,gold);scale=scale or 1;a:resize(a.width*scale,a.height*scale);im:drawImage(a,Point(x,y))
end
local function get(id)
 if not sources[id]then sources[id]=app.open(root..'/Characters/Source/'..id..'.aseprite')end;return sources[id]
end
local function tag(s,name)for _,t in ipairs(s.tags)do if t.name==name then return t end end;error(name)end
local function frame(s,name,f)local t=tag(s,name);local n=t.fromFrame.frameNumber+math.min(f,t.toFrame.frameNumber-t.fromFrame.frameNumber);local a=Image(128,128);a:drawSprite(s,n);return a end
local function art(image,path)
 local s=Sprite(image.width,image.height);s.layers[1].name='Actual source sprites and labels';s:newCel(s.layers[1],1,image,Point(0,0));s:saveAs(path..'.aseprite');image:saveAs(path..'.png');s:close()
end
local ids={'freed_rebel','retiarius','thraex','murmillo','secutor','rebel_champion'}
local function contact(name,rows,count)
 local out=Image(count*128,#rows*154);out:clear(panel)
 for i,r in ipairs(rows)do
  label(out,8,(i-1)*154+5,r[1]:upper()..' / '..r[2]:upper())
  for f=0,count-1 do out:drawImage(frame(get(r[1]),r[2],f),Point(f*128,(i-1)*154+20))end
 end
 out:saveAs(release..'/Validation/'..name..'.png')
end
local attacks={};for _,id in ipairs(ids)do attacks[#attacks+1]={id,'front_Attack'}end
contact('attacks',attacks,10)
contact('motion',{{'retiarius','front_Charge'},{'thraex','front_Charge'},{'rebel_champion','front_Death'},{'thraex','right_Death'}},12)
contact('defence',{{'murmillo','front_Block'},{'murmillo','front_BlockHit'},{'retiarius','front_NetCast'},{'thraex','left_Dodge'}},10)
local out=Image(6*192,4*224);out:clear(panel)
for d,dir in ipairs({'front','rear','right','left'})do
 label(out,10,(d-1)*224+5,dir:upper(),2)
 for i,id in ipairs(ids)do
  local a=frame(get(id),dir..'_Hold',2);a:resize(192,192);out:drawImage(a,Point((i-1)*192,(d-1)*224+22));label(out,(i-1)*192+8,d*224-9,id:upper())
 end
end
art(out,release..'/Store/four-views')
local function gif(name,items,clip,dir)
 local count=0;for _,id in ipairs(items)do local t=tag(get(id),dir..'_'..clip);count=math.max(count,t.toFrame.frameNumber-t.fromFrame.frameNumber+1)end
 local s=Sprite(#items*192,230);s.layers[1].name='Preview of shipped native animation'
 for f=0,count-1 do
  if f>0 then s:newEmptyFrame(f+1)end
  local first=get(items[1]);local t=tag(first,dir..'_'..clip);s.frames[f+1].duration=first.frames[math.min(t.fromFrame.frameNumber+f,t.toFrame.frameNumber)].duration
  local im=Image(s.width,s.height);im:clear(panel);label(im,12,9,dir:upper()..' / '..clip:upper(),2)
  for i,id in ipairs(items)do local a=frame(get(id),dir..'_'..clip,f);a:resize(192,192);im:drawImage(a,Point((i-1)*192,27));label(im,(i-1)*192+9,218,id:upper())end
  s:newCel(s.layers[1],f+1,im,Point(0,0))
 end
 s:saveAs(release..'/Store/'..name..'.gif');s:close()
end
gif('distinct-attacks',ids,'Attack','front');gif('charge',ids,'Charge','front');gif('fall',{'retiarius','thraex','rebel_champion'},'Death','right')
gif('block-hit',{'retiarius','murmillo','rebel_champion'},'BlockHit','front')
gif('dodge',{'retiarius','thraex','rebel_champion'},'Dodge','left')
gif('net-cast',{'retiarius'},'NetCast','front')
gif('side-combat',ids,'Attack','left');gif('rear-combat',ids,'Attack','rear')
local cover=Image(630,500);cover:clear(bg);label(cover,26,29,'GLADIATORS',4);label(cover,28,72,'THE UNBROKEN',3)
for i,id in ipairs({'retiarius','thraex','rebel_champion'})do local a=frame(get(id),'front_Hold',2);a:resize(384,384);cover:drawImage(a,Point(-85+(i-1)*190,83))end
label(cover,29,448,'SIX FIGHTERS / FOUR VIEWS',2);label(cover,29,474,'UNIQUE ATTACKS  DEFENCE  EDITABLE ASEPRITE')
art(cover,release..'/Store/cover-gladiators')
if #cat.variants>0 then
 local variants=Image(8*128,3*152);variants:clear(panel)
 for i,u in ipairs(cat.variants)do local s=app.open(root..'/'..u.source);local a=frame(s,'front_Idle',0);variants:drawImage(a,Point(((i-1)%8)*128,math.floor((i-1)/8)*152+16));label(variants,((i-1)%8)*128+3,math.floor((i-1)/8)*152+142,u.baseId:sub(1,8)..' '..((i-1)%4+1));s:close()end
 art(variants,release..'/Store/appearances')
end
for _,s in pairs(sources)do s:close()end
print('Native preview compositions exported')
