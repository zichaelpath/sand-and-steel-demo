-- Pixel drawings in the revised head coordinate system. All work is native cels.
return function(g)
 local shape,poly,line,pixel=g.shape,g.poly,g.line,g.pixel
 local styles={
  {id='close_crop',name='Close crop'}, {id='caesar',name='Caesar crop'},
  {id='side_part',name='Side part'}, {id='swept_back',name='Swept back'},
  {id='short_curls',name='Short curls'}, {id='tousled',name='Tousled'},
  {id='shoulder_length',name='Shoulder length'}, {id='tied_back',name='Tied back'}
 }
 local palettes={
  {id='black',name='Black',hex={'202528','353a39','545b55','72786a'}},
  {id='brown',name='Brown',hex={'352b26','594231','806249','a7855b'}},
  {id='auburn',name='Auburn',hex={'51312c','85513a','b5774e','d69b67'}},
  {id='blond',name='Blond',hex={'64533a','9b8050','cab072','e5ce93'}}
 }
 local function head(rear)
  if rear then
   shape({59,22,62,20,66,20,69,22,70,27,68,31,65,34,60,32,57,28,57,24},'mid')
   poly({60,22,64,21,67,23,68,27,65,31,61,31,59,27},'skin')
   poly({60,23,63,22,65,24,64,27,60,27},'light')
   line(61,32,61,34,'light');pixel(69,28,'shade')
   shape({56,26,58,25,59,27,58,30,56,29},'mid','shade');pixel(57,27,'light')
   pixel(70,26,'skin');pixel(70,28,'shade')
  else
   shape({59,22,62,20,66,20,69,22,69,25,70,27,71,29,70,30,69,32,66,34,61,33,58,30,57,26},'mid')
   poly({62,22,66,21,68,23,68,26,67,27,71,29,68,30,68,32,65,33,62,31,61,27},'skin')
   poly({62,23,66,22,67,24,64,25,62,25},'light')
   line(67,26,69,28,'light');pixel(70,29,'shine')
   line(64,26,68,26,'deep');pixel(65,27,'light');pixel(66,27,'eye')
   pixel(61,26,'shade');pixel(61,27,'eye')
   poly({63,29,65,28,67,29,66,30,63,30},'light')
   line(66,31,69,31,'deep');line(65,33,67,33,'light')
   line(60,30,62,32,'shade');pixel(70,30,'shade')
   shape({57,26,59,25,60,27,59,30,57,29},'skin','shade');pixel(58,27,'light');pixel(58,28,'shade')
  end
 end
 local function hairBack(id,rear)
  if id=='shoulder_length' then
   shape({58,22,61,20,67,20,71,24,72,31,74,39,72,42,67,40,64,42,59,41,54,40,55,33,55,27},'hair0','hair0')
   poly({57,27,61,24,61,33,59,39,56,38},'hair1')
   poly({65,25,69,25,70,32,72,39,68,38,66,34},'hair1')
   line(58,29,57,36,'hair2');line(69,31,70,37,'hair2')
   if rear then poly({59,25,66,23,69,28,67,35,65,40,60,39,61,34},'hair1');line(63,26,62,37,'hair2');line(66,29,65,36,'hair2')end
  elseif id=='tied_back' then
   local x=rear and 65 or 55
   shape({x-3,24,x-4,27,x-2,30,x+2,30,x+4,27,x+2,24},'hair0','hair0')
   poly({x-2,25,x+1,25,x+2,27,x,29,x-2,28},'hair1');pixel(x-1,26,'hair2')
   shape({x-1,29,x+2,30,x+1,34,x-2,38,x-4,38,x-2,34},'hair0','hair0')
   line(x,31,x-2,35,'hair1');line(x-2,29,x+1,30,'linen0')
  end
 end
 local function hairFront(id,rear)
  if rear then
   local cut=id=='close_crop'
   local low=cut and 30 or 32
   shape({57,24,59,21,63,19,67,20,70,23,70,27,68,low,64,low+1,60,low,57,28},'hair0','hair0')
   poly({59,24,62,21,66,21,68,24,67,28,63,30,59,28},'hair1')
   line(60,24,63,22,'hair2');line(60,27,62,27,'hair2')
   if id=='caesar' then line(59,30,66,31,'hair0');line(62,22,66,23,'hair2')
   elseif id=='side_part' then line(65,21,65,25,'hair0');line(60,25,63,24,'hair2')
   elseif id=='swept_back' then shape({57,23,59,19,64,17,68,19,70,22,69,25,65,23,60,24},'hair1','hair0');line(60,21,64,19,'hair2');line(63,24,67,21,'hair2')
   elseif id=='short_curls' then
    shape({56,24,56,21,59,20,59,18,62,18,64,17,67,18,69,20,71,21,71,24,69,25,67,24,64,25,61,24,59,26},'hair1','hair0')
    for _,p in ipairs({{58,22},{61,20},{65,19},{68,22},{60,26},{64,27},{68,27}})do pixel(p[1],p[2],'hair2');pixel(p[1]+1,p[2]+1,'hair0')end
   elseif id=='tousled' then shape({57,23,56,20,59,20,60,17,62,19,65,17,67,20,69,19,71,22,70,25,66,24,64,26,60,24},'hair1','hair0');line(60,21,61,20,'hair2');line(64,22,66,20,'hair2')
   elseif id=='shoulder_length' then
    poly({58,24,62,20,66,20,69,24,69,33,66,40,61,40,57,35},'hair1')
    line(62,23,61,36,'hair2');line(66,25,65,37,'hair2');line(68,29,67,36,'hair0')
   elseif id=='tied_back' then
    line(60,22,64,25,'hair2');line(67,22,65,25,'hair2')
    shape({62,26,64,24,67,25,69,28,67,31,64,31,62,29},'hair0','hair0');poly({64,26,66,26,67,28,65,30,63,28},'hair1');pixel(65,27,'hair2')
   end
   return
  end
  if id=='close_crop' then
   shape({57,24,59,21,63,19,67,20,69,22,69,24,66,23,63,23,60,25,58,27},'hair0','hair0')
   poly({59,23,63,20,66,21,67,22,63,22,60,24},'hair1');pixel(61,22,'hair2');pixel(64,21,'hair2')
  elseif id=='caesar' then
   shape({57,26,57,22,60,19,65,18,68,20,70,22,70,25,67,26,66,25,63,26,62,25,60,27},'hair0','hair0')
   poly({59,22,62,20,66,20,69,22,68,24,63,24,60,26,58,25},'hair1')
   line(60,22,62,21,'hair2');line(64,21,67,22,'hair2');pixel(64,24,'hair0')
  elseif id=='side_part' then
   shape({57,25,57,22,60,19,65,18,68,20,70,23,69,25,66,23,62,24,60,27,58,28},'hair0','hair0')
   poly({59,22,62,20,65,19,64,22,61,25,59,26},'hair1');line(60,22,63,20,'hair2')
   poly({66,20,68,21,69,23,67,22},'hair2');line(65,20,64,22,'hair0')
  elseif id=='swept_back' then
   shape({56,24,56,21,59,18,64,16,68,18,70,21,70,23,67,24,65,22,62,23,59,28,57,27},'hair0','hair0')
   poly({58,22,60,19,64,18,68,19,69,21,65,20,61,23,59,26},'hair1')
   line(59,21,64,18,'hair2');line(61,22,66,20,'hair2');pixel(68,21,'hair2')
  elseif id=='short_curls' then
   shape({56,25,56,21,58,21,58,19,61,18,64,17,66,18,68,18,68,20,71,21,71,24,69,26,67,25,65,26,63,24,61,27,59,28},'hair0','hair0')
   poly({58,23,60,20,63,19,66,20,68,20,69,23,67,24,65,23,62,24,60,26},'hair1')
   for _,p in ipairs({{58,23},{61,21},{64,20},{67,22},{60,25},{64,24}})do pixel(p[1],p[2],'hair2');pixel(p[1]+1,p[2]+1,'hair0')end
  elseif id=='tousled' then
   shape({56,25,57,22,56,20,59,20,61,17,63,19,65,17,67,20,69,19,70,22,72,23,69,26,67,24,65,27,63,25,60,27,59,29},'hair0','hair0')
   poly({59,22,61,20,63,21,65,19,66,22,69,22,67,24,64,24,60,26},'hair1')
   line(60,23,62,21,'hair2');line(65,22,66,21,'hair2');pixel(68,23,'hair2')
  elseif id=='shoulder_length' then
   shape({56,27,57,22,61,19,65,18,69,21,71,25,70,29,68,25,65,23,63,24,60,29,58,33,56,32},'hair0','hair0')
   poly({58,24,61,21,64,20,63,23,60,28,58,30},'hair1');line(59,24,62,21,'hair2')
   poly({65,20,68,22,69,25,66,23},'hair1');pixel(67,22,'hair2')
   line(57,30,56,36,'hair1');line(59,32,58,39,'hair2');line(68,34,70,38,'hair1')
  elseif id=='tied_back' then
   shape({56,26,57,22,60,19,64,18,68,20,70,23,68,24,65,22,62,23,60,26,58,29},'hair0','hair0')
   poly({58,23,61,20,64,20,66,21,62,22,59,26},'hair1')
   line(58,24,62,21,'hair2');line(60,24,64,22,'hair2');line(57,27,59,29,'hair1')
  end
 end
 local function helmet(id,rear)
  if id=='hood' then
   if rear then
    shape({55,23,58,18,63,16,69,19,72,24,72,32,74,38,67,41,58,40,53,36,55,30},'hood0')
    poly({57,24,60,19,64,18,68,21,69,29,66,36,60,37,56,34},'hood1');line(59,22,62,20,'hood2');line(58,26,57,33,'hood2');line(65,24,65,34,'hood0')
   else
    shape({54,35,55,25,57,20,62,16,68,18,72,23,72,26,68,23,63,21,60,25,60,30,63,35,69,37,67,40,57,39},'hood0')
    poly({57,25,59,21,62,19,65,19,62,22,59,26,58,32,61,36,57,35},'hood1');line(58,23,61,20,'hood2');line(56,28,56,33,'hood2')
   end
   return
  end
  shape({55,27,55,23,58,19,62,17,66,17,70,20,73,25,73,28},'steel0')
  poly({57,24,60,20,63,18,66,19,69,22,70,26,58,26},'steel1')
  poly({58,24,61,20,63,19,64,24,63,26,58,26},'steel2')
  line(59,21,63,18,'steel3');line(64,19,66,26,'steel3');line(55,27,73,27,'steel3')
  if rear then
   shape({56,28,72,28,73,32,70,36,59,36,55,32},'steel0');poly({57,29,70,29,71,31,68,34,59,34},'steel1');line(57,29,70,29,'steel2')
  else
   shape({55,28,59,28,60,32,58,35,55,33},'steel0');line(56,29,57,33,'steel2')
  end
  if id=='cheek_guard' or id=='crest' then
   shape({58,28,61,29,63,34,60,38,57,36,56,31},'steel1');line(58,30,60,34,'steel3')
   if rear then shape({69,29,72,28,73,34,70,37,68,34},'steel0');line(71,30,71,34,'steel2')end
  end
  if id=='crest' then
   shape({59,17,60,13,63,11,68,12,71,15,70,18,67,16,63,15},'crest0')
   line(62,13,66,13,'crest1');line(66,13,68,14,'crest2')
  end
 end
 return {head=head,hairBack=hairBack,hairFront=hairFront,helmet=helmet,styles=styles,palettes=palettes}
end
