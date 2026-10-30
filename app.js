(function(){
let T=0.28,THK=2.8,ANG=3,AT=0.3,TA=2,TB=2,TT=1.25,TON=true;
const SQ=[12,16,20,25,30,40,50,60,75,80,100];                       // square tubes (mm)
const RECT=[[10,15],[15,30],[20,30],[20,40],[25,50],[30,60],[40,80],[50,100]]; // rectangular tubes (mm)
const compat=a=>{if(!a)return[0];const r=new Set();if(SQ.includes(a))r.add(a);RECT.forEach(([p,q])=>{if(p===a)r.add(q);if(q===a)r.add(p);});return[...r].filter(x=>x<=a).sort((x,y)=>x-y);}; // side B never exceeds side A
const TAL=[0,...[...new Set([...SQ,...RECT.flat()])].sort((x,y)=>x-y).filter(a=>compat(a).length)];
const TTH=[1,1.2,1.25,1.5,1.8,2,2.5,3,4,5,6]; // standard tube sides / wall thicknesses (mm)
const SHEETS=[1.25,1.5,1.8,2,2.8,4,5,6,8]; // market sheet thicknesses (mm), nominal
const BAR=600;
const tubeKg=()=>2*TT*(TA*10+TB*10-2*TT)*7.85/1000; // kg per metre
const angKg=()=>(2*ANG*10-AT*10)*(AT*10)*7.85/1000; // kg per metre
const $=id=>document.getElementById(id);

/* ---------- cut list and cost ---------- */
function geom(L,W,H,C){
  const Lc=L+2*C,Wc=W+2*C,Hc=H+C;
  const nr=Math.max(1,Math.ceil(L/30)-1);
  const TONn=TA>0&&TB>0;
  const rl=L-2*T, rs=W-2*T-2*TB, cv=H-T-TA;
  const tubes=!TONn?[]:[
    ['حلقة علوية طويلة',2,rl],['حلقة علوية قصيرة',2,rs],
    ['حلقة وسطى طويلة',2,rl],['حلقة وسطى قصيرة',2,rs],
    ['أعمدة الأركان',4,cv],['عمود منتصف كل جانب',4,cv],
    ['ضلوع عرضية علوية',nr,rs],['ضلوع عرضية وسطى',nr,rs],
    ['عمود الرفع الأوسط',1,rl-2*TB]
  ];
  const sheet=[[Lc+2*T+2*ANG,Hc],[Lc+2*T+2*ANG,Hc],[Wc,Hc],[Wc,Hc],[Lc+2*ANG,Wc+2*ANG]];
  const nrib=len=>len>50?2:1,nl=nrib(Lc),ns=nrib(Wc); // walls longer than 50 cm get two T-ribs
  const flat=[];for(let i=0;i<2*nl+2*ns;i++)flat.push(Hc-2*AT);      // mid flat bars: width = angle leg, thickness = angle thickness
  const nh=Math.max(0,Math.ceil(Hc/50-1e-9)-1); // horizontal flat-bar stiffeners: one more for every extra 50 cm of wall height
  for(let h=0;h<nh;h++){
    for(let j=0;j<2*(nl+1);j++)flat.push(Lc/(nl+1)-AT);
    for(let j=0;j<2*(ns+1);j++)flat.push(Wc/(ns+1)-AT);
  }
  sheet.push([L,H],[L,H],[W-2*T,H],[W-2*T,H],[L,W]);   // core walls + face
  const ang=[];for(let i=0;i<4;i++)ang.push(Lc+2*T+2*ANG,Wc,Hc-2*AT);
  return {Lc,Wc,Hc,nr,nl,ns,nh,tubes,sheet,ang,flat};
}
function maxrects(pieces,bins){
  const free=bins.map(b=>[{x:0,y:0,w:b[0],h:b[1]}]);
  for(const p of pieces){
    let best=null;
    for(let bi=0;bi<free.length;bi++)for(const r of free[bi])for(let rot=0;rot<2;rot++){
      const w=rot?p[1]:p[0],h=rot?p[0]:p[1];
      if(w<=r.w+1e-9&&h<=r.h+1e-9){
        const sc=Math.min(r.w-w,r.h-h),sc2=Math.max(r.w-w,r.h-h);
        if(!best||sc<best.sc||(sc===best.sc&&sc2<best.sc2))best={bi,r,w,h,sc,sc2};
      }
    }
    if(!best)return false;
    const px=best.r.x,py=best.r.y,pw=best.w,ph=best.h,list=free[best.bi],out=[];
    for(const r of list){
      if(px>=r.x+r.w||px+pw<=r.x||py>=r.y+r.h||py+ph<=r.y){out.push(r);continue;}
      if(px>r.x)out.push({x:r.x,y:r.y,w:px-r.x,h:r.h});
      if(px+pw<r.x+r.w)out.push({x:px+pw,y:r.y,w:r.x+r.w-px-pw,h:r.h});
      if(py>r.y)out.push({x:r.x,y:r.y,w:r.w,h:py-r.y});
      if(py+ph<r.y+r.h)out.push({x:r.x,y:py+ph,w:r.w,h:r.y+r.h-py-ph});
    }
    free[best.bi]=out.filter((a,i)=>!out.some((b,j)=>j!==i&&a.x>=b.x-1e-9&&a.y>=b.y-1e-9&&a.x+a.w<=b.x+b.w+1e-9&&a.y+a.h<=b.y+b.h+1e-9&&(a.x!==b.x||a.y!==b.y||a.w!==b.w||a.h!==b.h||j<i)));
  }
  return free;
}
function bestSheets(pieces){
  const A1=2.0,A2=1.22*2.44,need=pieces.reduce((s,p)=>s+p[0]*p[1],0)/1e4;
  const ps=pieces.slice().sort((a,b)=>b[0]*b[1]-a[0]*a[1]);
  const c=[];
  for(let a=0;a<=12;a++)for(let b=0;b<=12;b++){const ar=a*A1+b*A2;if(ar>=need&&a+b>0)c.push([ar,a,b]);}
  c.sort((x,y)=>x[0]-y[0]);
  for(const [ar,a,b] of c.slice(0,160)){
    const bins=[];for(let i=0;i<b;i++)bins.push([122,244]);for(let i=0;i<a;i++)bins.push([100,200]);
    const fr=maxrects(ps,bins);
    if(fr)return {a,b,area:ar,need,free:fr,bins};
  }
  return null;
}
const FR=[.25,1/3,.5,2/3,.75,1];
const nearF=x=>FR.some(f=>Math.abs(x-f)<=0.06);
/* default waste: 3% base (cuts + joints) + a share of the leftover that cannot be reused later (not a clean 1/4, 1/3, 1/2, 2/3, 3/4 of the sheet), max 10% */
function autoWaste(res){
  if(!res)return 5;
  const area=res.bins.reduce((s,b)=>s+b[0]*b[1],0),left=area-res.need*1e4;
  let clean=0;
  res.free.forEach((list,bi)=>{
    const [Ws,Hs]=res.bins[bi],picked=[];
    list.filter(r=>nearF(r.w/Ws)&&nearF(r.h/Hs)).sort((p,q)=>q.w*q.h-p.w*p.h).forEach(r=>{
      if(picked.some(q=>!(r.x>=q.x+q.w-1e-9||r.x+r.w<=q.x+1e-9||r.y>=q.y+q.h-1e-9||r.y+r.h<=q.y+1e-9)))return;
      picked.push(r);clean+=r.w*r.h;
    });
  });
  const u=Math.max(0,left-clean)/area*100;
  return Math.round(Math.min(10,3+0.25*u)*2)/2;
}
function ffd(lens){
  const bins=[];
  lens.slice().sort((x,y)=>y-x).forEach(l=>{
    const b=bins.find(r=>r.left>=l-1e-9);
    if(b)b.left-=l;else bins.push({left:BAR-l});
  });
  return bins.length;
}
const f1=x=>(Math.round(x*10)/10).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:1});
const money=x=>'⃁ '+Math.round(x).toLocaleString('en-US');
function renderCost(g){
  const pS=parseFloat($('pSheet').value)||0,pA=parseFloat($('pAng').value)||0,pT=parseFloat($('pTube').value);
  const res=bestSheets(g.sheet);
  if($('wAuto').checked&&res){$('pW').value=autoWaste(res);$('oW').textContent=$('pW').value;}
  const wf=1+(Math.max(0,parseFloat($('pW').value)||0))/100,wp=Math.round((wf-1)*1000)/10;
  const SK=7.85*THK;
  const uS=g.sheet.reduce((s,p)=>s+p[0]*p[1],0)/1e4*SK;
  const uA=g.ang.reduce((s,x)=>s+x,0)/100*angKg();
  let h='<h2>القطع والتكلفة</h2><table><tr><th>الخامة</th><th>المستعمل</th><th>مع الهدر ('+wp+'%)</th><th>التكلفة</th></tr>';
  let total=0,missing=false;
  const buy=[];
  const cS=uS*wf*pS/1000;total+=cS;
  h+=`<tr><td>صاج ${THK} مم</td><td>${f1(uS)}</td><td>${f1(uS*wf)}</td><td>${money(cS)}</td></tr>`;
  if(res)buy.push('صاج: '+[res.a?res.a+' لوح 100×200':'',res.b?res.b+' لوح 122×244':''].filter(Boolean).join(' + '));
  else buy.push('صاج: القطع أكبر من أقصى لوح متاح');
  const uF=g.flat.reduce((a,x)=>a+x,0)*ANG*AT*7.85/1000;
  const cF=uF*wf*pS/1000;total+=cF;
  h+=`<tr><td>مبسط ${ANG*10}×${AT*10} مم</td><td>${f1(uF)}</td><td>${f1(uF*wf)}</td><td>${money(cF)}</td></tr>`;
  buy.push('مبسط: '+ffd(g.flat)+' عود 6 م');
  const cA=uA*wf*pA/1000;total+=cA;
  h+=`<tr><td>زاوية ربط ${ANG*10}×${ANG*10}×${AT*10} مم</td><td>${f1(uA)}</td><td>${f1(uA*wf)}</td><td>${money(cA)}</td></tr>`;
  buy.push('زاوية: '+ffd(g.ang)+' عود 6 م');
  if(g.tubes.length){
    const tl=[];g.tubes.forEach(t=>{for(let i=0;i<t[1];i++)tl.push(t[2]);});
    const uT=tl.reduce((s,x)=>s+x,0)/100*tubeKg();
    const tn=`تيوب تدعيم داخلي ${TA*10}×${TB*10}×${TT} مم`;
    if(pT>0){const ct=uT*wf*pT/1000;total+=ct;h+=`<tr><td>${tn}</td><td>${f1(uT)}</td><td>${f1(uT*wf)}</td><td>${money(ct)}</td></tr>`;}
    else{missing=true;h+=`<tr><td>${tn}</td><td>${f1(uT)}</td><td>${f1(uT*wf)}</td><td class="warn">أدخل السعر</td></tr>`;}
    buy.push('تيوب: '+ffd(tl)+' عود 6 م');
  }
  h+=`<tr class="total"><td colspan="3">الإجمالي${missing?' (بدون التيوب)':''}</td><td>${money(total)}</td></tr></table>`;
  h+='<p class="dim" style="margin:6px 0 0;font-size:.9rem">الوزن بالكجم. التكلفة = الوزن المستعمل × (1 + الهدر) × سعر الطن. لا تشمل القص واللحام والمسامير والدهان. السماكة اسمية، وقد تنقص 0.2 مم فيما فوق 2.8.</p>';
  h+='<p class="dim" style="margin:4px 0 0;font-size:.9rem">للشراء بعد التقسيم الفعلي: '+buy.join(' · ')+'.</p>';
  $('cost').innerHTML=h;
  const m=Math.max(0,parseFloat($('pM').value)||0),pre=total*m,vat=pre*0.15;
  $('sCost').innerHTML=money(total);
  $('sPct').textContent='(ربح '+(Math.round((m-1)*1000)/10)+'%)';
  $('sLbl').textContent='السعر قبل الضريبة ('+m+' '+(m===1?'ضعف':(m>=3&&m<=10&&m===Math.floor(m)?'أضعاف':'ضعف'))+')';
  $('sPre').innerHTML=money(pre);$('sVat').innerHTML=money(vat);$('sPost').innerHTML=money(pre+vat);
}

/* ---------- 3D ---------- */
const view=$('view');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
view.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,1,3000);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.08;
scene.add(new THREE.AmbientLight(0xffffff,.62));
const d1=new THREE.DirectionalLight(0xffffff,.8);d1.position.set(120,200,90);scene.add(d1);
const d2=new THREE.DirectionalLight(0xffffff,.35);d2.position.set(-150,80,-120);scene.add(d2);
const M=(c,o)=>new THREE.MeshStandardMaterial({color:c,roughness:.6,metalness:.3,transparent:o!==undefined,opacity:o===undefined?1:o,depthWrite:o===undefined});
const mats={wall:M(0x56606e),floor:M(0x3d4653),ang:M(0xa3acb6),strip:M(0xc8a24a),bolt:M(0xe0a800),core:M(0x2b7a9b),tube:M(0xc3e3f0),conc:M(0xcfc9bc,.38)};
const lineMat=new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.28});
function box(p,w,h,d,x,y,z,m,edges){
  const g=new THREE.BoxGeometry(w,h,d),me=new THREE.Mesh(g,m);
  me.position.set(x,y,z);p.add(me);
  if(edges!==false)me.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),lineMat));
  return me;
}
function bolt(p,cx,cy,cz,dir,len,nut){ // dir: head -> tip
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,len,10),mats.bolt));
  const hd=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,.45,6),mats.bolt);hd.position.y=-len/2-.1;g.add(hd);
  if(nut){const nt=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,.6,6),mats.bolt);nt.position.y=len/2;g.add(nt);}
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
  g.position.set(cx,cy,cz);p.add(g);return g;
}
const boltCount=len=>Math.max(1,Math.floor((len-6)/30))+1;
const boltPos=(len,n)=>{const a=[],s=(len-6)/(n-1);for(let i=0;i<n;i++)a.push(-len/2+3+i*s);return a;};
let root=null,S={};
const seg=(s,a,b)=>Math.min(1,Math.max(0,(s-a)/(b-a)));

function build(resetCam){
  const L=+$('sx').value,W=+$('sy').value,H=+$('sz').value,C=+$('st').value;THK=SHEETS[+$('sm').value];T=THK/10;TA=TAL[+$('ta').value]/10;TB=bVal/10;TT=ttVal;ANG=ANGL[+$('sa').value]/10;AT=atVal/10;
  if(root){scene.remove(root);root.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  root=new THREE.Group();scene.add(root);
  const g0=geom(L,W,H,C),{Lc,Wc,Hc,nr,nl,ns,nh}=g0;
  S={L,W,H,Lc,Wc,Hc,g:g0};
  const gCore=new THREE.Group(),gConc=new THREE.Group(),gFloor=new THREE.Group(),gOuter=new THREE.Group();
  const gLong={1:new THREE.Group(),'-1':new THREE.Group()},gShort={1:new THREE.Group(),'-1':new THREE.Group()};
  gOuter.add(gFloor,gLong[1],gLong[-1],gShort[1],gShort[-1]);
  root.add(gOuter,gCore,gConc);
  const jb=[],bb=[],cb=[],info={};
  box(gFloor,Lc+2*ANG,T,Wc+2*ANG,0,-T/2,0,mats.floor);
  [1,-1].forEach(sz=>{
    const g=gLong[sz],zo=sz*(Wc/2+T),aL=Lc+2*T+2*ANG;
    box(g,Lc+2*T+2*ANG,Hc,T,0,Hc/2,sz*(Wc/2+T/2),mats.wall); // sheet runs 3 cm past each corner
    box(g,aL,AT,ANG-.3,0,Hc-AT/2,zo+sz*(ANG-.3)/2,mats.ang);
    box(g,aL,ANG,AT,0,Hc-ANG/2,zo+sz*AT/2,mats.ang);
    box(g,aL,AT,ANG-.3,0,AT/2,zo+sz*(ANG-.3)/2,mats.ang);
    box(g,aL,ANG,AT,0,ANG/2,zo+sz*AT/2,mats.ang);
    for(let k=1;k<=nl;k++){ // T-ribs: ends rest on the angle flanges (notched around the angle leg)
      const px=-Lc/2+k*Lc/(nl+1);
      box(g,AT,Hc-2*ANG,ANG,px,Hc/2,zo+sz*ANG/2,mats.strip);
      [(AT+ANG)/2,Hc-(AT+ANG)/2].forEach(y=>box(g,AT,ANG-AT,ANG-AT,px,y,zo+sz*(AT+(ANG-AT)/2),mats.strip));
    }
    for(let h=1;h<=nh;h++)for(let j=0;j<=nl;j++){ // horizontal flat bars between the T-ribs
      const sl=Lc/(nl+1);box(g,sl-AT,AT,ANG,-Lc/2+(j+.5)*sl,Hc*h/(nh+1),zo+sz*ANG/2,mats.strip);
    }
    const n=boltCount(aL);info.botLong=n;
    boltPos(aL,n).forEach(x=>{const b=bolt(gOuter,x,-.4,zo+sz*(ANG-.3)/2,new THREE.Vector3(0,-1,0),2.0,true);bb.push({g:b,by:b.position.y});});
  });
  [1,-1].forEach(sx=>{
    const g=gShort[sx],xo=sx*(Lc/2+T),rA=Wc;
    box(g,T,Hc,Wc,sx*(Lc/2+T/2),Hc/2,0,mats.wall);
    box(g,ANG-.3,AT,rA,xo+sx*(ANG-.3)/2,Hc-AT/2,0,mats.ang);
    box(g,AT,ANG,rA,xo+sx*AT/2,Hc-ANG/2,0,mats.ang);
    box(g,ANG-.3,AT,rA,xo+sx*(ANG-.3)/2,AT/2,0,mats.ang);
    box(g,AT,ANG,rA,xo+sx*AT/2,ANG/2,0,mats.ang);
    for(let k=1;k<=ns;k++){
      const pz=-Wc/2+k*Wc/(ns+1);
      box(g,ANG,Hc-2*ANG,AT,xo+sx*ANG/2,Hc/2,pz,mats.strip);
      [(AT+ANG)/2,Hc-(AT+ANG)/2].forEach(y=>box(g,ANG-AT,ANG-AT,AT,xo+sx*(AT+(ANG-AT)/2),y,pz,mats.strip));
    }
    [1,-1].forEach(sz=>{
      // inverted corner angle: leg A welded on the short wall, leg B sticks out and meets the long wall's 3 cm extension
      // vertical angle meets the rim angles: leg A stops at the rim legs, leg B ends rest on the rim flanges
      box(g,AT,Hc-2*ANG,ANG,xo+sx*AT/2,Hc/2,sz*(Wc/2-ANG/2),mats.ang);
      box(g,ANG,Hc-2*ANG,AT,xo+sx*ANG/2,Hc/2,sz*(Wc/2-AT/2),mats.ang);
      [(AT+ANG)/2,Hc-(AT+ANG)/2].forEach(y=>box(g,ANG-AT,ANG-AT,AT,xo+sx*(AT+(ANG-AT)/2),y,sz*(Wc/2-AT/2),mats.ang));
      [ANG+4,Hc/2,Hc-ANG-4].forEach(y=>{
        const len=T+.7,zc=sz*(Wc/2+T+.1-len/2);
        const b=bolt(gOuter,xo+sx*ANG/2,y,zc,new THREE.Vector3(0,0,-sz),len,true);
        jb.push({g:b,sz,bz:b.position.z});
      });
    });
    for(let h=1;h<=nh;h++)for(let j=0;j<=ns;j++){
      const sl=Wc/(ns+1);box(g,ANG,AT,sl-AT,xo+sx*ANG/2,Hc*h/(nh+1),-Wc/2+(j+.5)*sl,mats.strip);
    }
    const n=boltCount(rA);info.botShort=n;
    boltPos(rA,n).forEach(z=>{const b=bolt(gOuter,xo+sx*(ANG-.3)/2,-.4,z,new THREE.Vector3(0,-1,0),2.0,true);bb.push({g:b,by:b.position.y});});
  });
  // concrete ghost
  box(gConc,Lc,C,Wc,0,C/2,0,mats.conc,false);
  [1,-1].forEach(s=>{
    box(gConc,Lc,Hc-C,C,0,C+(Hc-C)/2,s*(W/2+C/2),mats.conc,false);
    box(gConc,C,Hc-C,W,s*(L/2+C/2),C+(Hc-C)/2,0,mats.conc,false);
  });
  // core
  const y0=C;
  box(gCore,L,T,W,0,y0+T/2,0,mats.core);
  [1,-1].forEach(s=>{
    box(gCore,L,H,T,0,y0+H/2,s*(W/2-T/2),mats.core);
    box(gCore,T,H,W-2*T,s*(L/2-T/2),y0+H/2,0,mats.core);
  });
  const lugL=C+T+ANG-.3;
  [1,-1].forEach(sx=>{
    box(gCore,lugL,AT,10,sx*(L/2+lugL/2),Hc+AT/2,0,mats.core);
    const len=2*AT+.8,b=bolt(root,sx*(Lc/2+T+(ANG-.3)/2),Hc+AT+.1-len/2,0,new THREE.Vector3(0,-1,0),len,true);
    cb.push({g:b,by:b.position.y});
  });
  if(g0.tubes.length){
    const add=(w,h,d,x,y,z)=>box(gCore,w,h,d,x,y,z,mats.tube);
    const rl=L-2*T,rs=W-2*T-2*TB,yT=Hc-TA/2,yM=y0+H/2;
    [yT,yM].forEach(y=>{
      [1,-1].forEach(s=>{add(rl,TA,TB,0,y,s*(W/2-T-TB/2));add(TB,TA,rs,s*(L/2-T-TB/2),y,0);});
      for(let k=1;k<=nr;k++)add(TB,TA,rs,-L/2+k*L/(nr+1),y,0);
    });
    const vc=H-T-TA,vy=(y0+T+Hc-TA)/2;
    [1,-1].forEach(s=>[1,-1].forEach(s2=>add(TA,vc,TB,s*(L/2-T-TA/2),vy,s2*(W/2-T-TB/2))));
    [1,-1].forEach(s=>{add(TA,vc,TB,0,vy,s*(W/2-T-TB/2));add(TB,vc,TA,s*(L/2-T-TB/2),vy,0);});
    add(rl-2*TB,TA,TB,0,yT+TA,0);
    [-1,1].forEach(k=>add(TB,5,TB,k*4,yT+TA+3.5,0));
    add(10,TA,TB,0,yT+TA+6.5,0);
  }
  Object.assign(S,{cb,gCore,gConc,gFloor,gOuter,gLong,gShort,jb,bb,info});
  if(resetCam){
    const R=Math.max(Lc,Wc,Hc);
    controls.target.set(0,Hc*.75+8,0);
    camera.position.set(R*1.9,R*1.5+Hc*.5,R*2.0);controls.update();
  }
  drawSvgs();renderInfo();renderCost(g0);applyVis();apply(+slider.value/1000);
}
function drawSvgs(){
  const f=x=>+(+x).toFixed(2);
  const vd=(x,y1,y2)=>`<path d="M${f(x)},${f(y1)} V${f(y2)} M${f(x-2.2)},${f(y1)} h4.4 M${f(x-2.2)},${f(y2)} h4.4"/>`;
  const hd=(y,x1,x2)=>`<path d="M${f(x1)},${f(y)} H${f(x2)} M${f(x1)},${f(y-2.2)} v4.4 M${f(x2)},${f(y-2.2)} v4.4"/>`;
  const G=c=>`<g stroke="currentColor" stroke-width=".6" fill="none">${c}</g>`;
  /* angle section (like the catalogue drawing): sharp outer corner, inner fillet, rounded toes; numbers follow the sliders */
  const a=ANG*10,ta=AT*10,k=0.7,la=a*k,t=Math.max(ta*k,1.2),r1=Math.min(t*1.2,la-t),r2=Math.min(t*0.6,t),x0=19,yb=58,top=yb-la;
  const d=`M${x0},${yb} L${x0},${f(top)} L${f(x0+t-r2)},${f(top)} A${f(r2)},${f(r2)} 0 0 1 ${f(x0+t)},${f(top+r2)} L${f(x0+t)},${f(yb-t-r1)} A${f(r1)},${f(r1)} 0 0 0 ${f(x0+t+r1)},${f(yb-t)} L${f(x0+la-r2)},${f(yb-t)} A${f(r2)},${f(r2)} 0 0 1 ${f(x0+la)},${f(yb-t+r2)} L${f(x0+la)},${yb} Z`;
  $('dAng').innerHTML=`<path class="shp" d="${d}" fill="#e9dfa8" style="stroke-width:.9"/>`+G(vd(x0-7,top,yb)+hd(yb+8,x0,x0+la)+vd(x0+la+5,yb-t,yb))+`<text x="${x0-12}" y="${f((top+yb)/2+3)}">${a}</text><text x="${f(x0+la/2)}" y="${yb+20}">${a}</text><text x="${f(x0+la+10)}" y="${f(yb-t/2+3)}">${ta}</text>`;
  /* tube section: outer corner radius = wall thickness */
  if(TA>0&&TB>0){
    const q=0.55,w=TA*10*q,h=TB*10*q,tt=Math.max(TT*q,0.8),ro=Math.max(TT*q,0.8),ri=ro/2,x=45-w/2,y=58-h;
    $('dTube').innerHTML=`<rect class="shp" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(ro)}" fill="#c3e3f0"/><rect class="shp" x="${f(x+tt)}" y="${f(y+tt)}" width="${f(Math.max(w-2*tt,0))}" height="${f(Math.max(h-2*tt,0))}" rx="${f(ri)}" fill="var(--panel)"/>`+G(vd(x-6,y,58)+hd(66,x,x+w)+vd(x+w+5,y,y+tt))+`<text x="${f(x-13)}" y="${f(y+h/2+3)}">${TB*10}</text><text x="45" y="${78}">${TA*10}</text><text x="${f(x+w+14)}" y="${f(y+tt/2+3)}">${TT}</text>`;
  }else $('dTube').innerHTML='<text x="45" y="46">بدون تدعيم</text>';
}
function renderInfo(){
  const s=S,i=s.info,g=s.g;
  let h='<h2>المقاسات والتثبيت (سم)</h2><table><tr><th>الجزء</th><th>المقاس</th></tr>';
  h+=`<tr><td>القالب الداخلي</td><td>${s.L}×${s.W}×${s.H}</td></tr>`;
  h+=`<tr><td>تجويف القالب الخارجي</td><td>${s.Lc}×${s.Wc}×${s.Hc}</td></tr>`;
  h+=`<tr><td>الأرضية</td><td>${s.Lc+2*ANG}×${s.Wc+2*ANG}</td></tr>`;
  h+=`<tr><td>مسامير اللُّب</td><td>2 (في الطرفين المتقابلين)</td></tr>`;
  h+=`<tr><td>مسامير الزوايا العمودية</td><td>3 × 4 = 12</td></tr>`;
  h+=`<tr><td>مسامير الأرضية</td><td>${2*i.botLong+2*i.botShort}</td></tr></table>`;
  if(!g.tubes.length){$('info').innerHTML=h+'<p class="dim">تدعيم اللُّب بالتيوب مُلغى (قيمة الضلع 0).</p>';return;}
  h+=`<h2 style="margin-top:12px">تيوب اللُّب ${TA*10}×${TB*10}×${TT} مم</h2><table><tr><th>القطعة</th><th>العدد</th><th>الطول</th></tr>`;
  let tot=0;g.tubes.forEach(t=>{h+=`<tr><td>${t[0]}</td><td>${t[1]}</td><td>${f1(t[2])}</td></tr>`;tot+=t[1]*t[2];});
  h+=`<tr><th>المجموع</th><th></th><th>${f1(tot/100)} م</th></tr></table>`;
  $('info').innerHTML=h;
}
const labels=[[0,.07,'1 · فك مسماري اللُّب'],[.07,.2,'1 · رفع اللُّب من العمود الأوسط'],[.2,.4,'2 · فك مسامير الزوايا العمودية'],[.4,.55,'3 · فك مسامير الأرضية'],[.55,.75,'4 · سحب الجوانب الطويلة'],[.75,.9,'4 · سحب الجوانب القصيرة'],[.9,1.001,'5 · رفع القطعة عن الأرضية']];
const lab=$('stepLabel');
function apply(s){
  S.cb.forEach(o=>{o.g.position.y=o.by+seg(s,0,.07)*14;});
  S.gCore.position.y=seg(s,.07,.2)*(S.Hc+24);
  S.jb.forEach(o=>{o.g.position.z=o.bz+o.sz*seg(s,.2,.4)*14;});
  S.bb.forEach(o=>{o.g.position.y=o.by+seg(s,.4,.55)*12;});
  [1,-1].forEach(k=>{S.gLong[k].position.z=k*seg(s,.55,.75)*34;S.gShort[k].position.x=k*seg(s,.75,.9)*34;});
  S.gFloor.position.y=-seg(s,.9,1)*26;
  let t='';for(const l of labels){if(s>=l[0]&&s<l[1]){t=l[2];break;}}
  if(s>=1)t=labels[5][2];
  lab.innerHTML=s===0?'<b>الوضع</b>مركّب وجاهز للصب':'<b>الخطوة</b>'+t;
}
function applyVis(){
  S.gCore.visible=$('tCore').checked;S.gOuter.visible=$('tOuter').checked;S.gConc.visible=$('tConc').checked;
}

/* ---------- UI ---------- */
const slider=$('slider');
function outs(){$('ox').textContent=$('sx').value;$('oy').textContent=$('sy').value;$('oz').textContent=$('sz').value;$('ot').textContent=$('st').value;$('om').textContent=SHEETS[+$('sm').value];$('oa').textContent=ANGL[+$('sa').value];$('ota').textContent=TAL[+$('ta').value]||'0';$('otb').textContent=bVal||'0';$('ott').textContent=ttVal;$('oat').textContent=atVal;}
let pend=false;
function schedule(){outs();if(pend)return;pend=true;requestAnimationFrame(()=>{pend=false;build(false);});}
function limitY(){const x=+$('sx').value;if(+$('sy').value>x)$('sy').value=x;} // length is free; the width thumb stops at the length thumb (same scale)
$('sx').addEventListener('input',limitY);$('sy').addEventListener('input',limitY);
['sx','sy','sz','st','sm'].forEach(id=>$(id).addEventListener('input',schedule));
const ANGL=[25,30,40,50,60,70,80],ANGT={25:[2.5,3],30:[2.5,3],40:[3,4,5],50:[4,5,6],60:[5,6],70:[5,6,7],80:[6,8,10]}; // angle sizes (mm) and their thicknesses (mm)
let atVal=3,atList=[2.5,3];
function syncA(){const l=ANGL[+$('sa').value];atList=ANGT[l];let i=atList.indexOf(atVal);if(i<0){i=atList.filter(x=>x<atVal).length-1;if(i<0)i=0;}atVal=atList[i];const t=$('sat');t.max=atList.length-1;t.value=i;t.disabled=atList.length<2;}
$('sa').addEventListener('input',()=>{syncA();schedule();});
$('sat').addEventListener('input',()=>{atVal=atList[+$('sat').value];schedule();});
let bVal=20,bList=[],ttVal=1.25,ttList=TTH;
function syncB(){ // second side offers only the sizes that exist with the first side
  const a=TAL[+$('ta').value];bList=compat(a);
  let i=bList.indexOf(bVal);if(i<0){i=bList.indexOf(a);if(i<0)i=0;}
  bVal=bList[i];const tb=$('tb');tb.max=bList.length-1;tb.value=i;tb.disabled=bList.length<2;
  syncT();
}
function syncT(){ // max wall thickness by the smaller side: up to 30 mm (e.g. 30x30, 60x30): 3, 40-50 mm (e.g. 40x40): 5, 60 mm and up: 6
  const a=TAL[+$('ta').value],m=Math.min(a||999,bVal||999),mx=m<=30?3:m<60?5:6;
  ttList=TTH.filter(x=>x<=mx);
  if(ttVal>mx)ttVal=mx;
  let i=ttList.indexOf(ttVal);if(i<0){i=ttList.filter(x=>x<ttVal).length-1;if(i<0)i=0;}
  ttVal=ttList[i];const t=$('tt');t.max=ttList.length-1;t.value=i;
}
$('tt').addEventListener('input',()=>{ttVal=ttList[+$('tt').value];schedule();});
$('ta').addEventListener('input',()=>{syncB();schedule();});
$('tb').addEventListener('input',()=>{bVal=bList[+$('tb').value];syncT();schedule();});
$('pW').addEventListener('input',()=>{$('wAuto').checked=false;$('oW').textContent=$('pW').value;});
$('wAuto').addEventListener('change',()=>renderCost(S.g));
$('pSheet').addEventListener('input',()=>{const v=+$('pSheet').value;['pAng','pTube'].forEach(i=>{$(i).min=v+300;$(i).max=Math.max(6500,v+3000);$(i).value=v+500;});['oPA','oPT'].forEach((o,k)=>{$(o).textContent=$(k?'pTube':'pAng').value;});});
[['pSheet','oPS'],['pAng','oPA'],['pTube','oPT']].forEach(([i,o])=>{const u=()=>{$(o).textContent=$(i).value;};$(i).addEventListener('input',u);u();});
const clampM=()=>{let v=parseFloat($('pM').value);if(!(v>=2))v=2;if(v>6)v=6;$('pM').value=v;};
const stepM=d=>{let v=parseFloat($('pM').value);if(isNaN(v))v=2.5;v=Math.round((v+d)*100)/100;$('pM').value=Math.min(6,Math.max(2,v));renderCost(S.g);};
$('mUp').addEventListener('click',()=>stepM(0.25));$('mDn').addEventListener('click',()=>stepM(-0.25));
['change','blur'].forEach(ev=>$('pM').addEventListener(ev,()=>{clampM();renderCost(S.g);}));
$('pM').addEventListener('keydown',e=>{if(e.key==='Enter')$('pM').blur();});
['pSheet','pAng','pTube','pW','pM'].forEach(id=>$(id).addEventListener('input',()=>renderCost(S.g)));

slider.oninput=()=>{stopPlay();apply(+slider.value/1000);};
[0,.2,.4,.55,.9,1].forEach((v,k)=>{$('b'+k).onclick=()=>{stopPlay();tgt=v;};});
let playing=false,tgt=null;
function setS(v){slider.value=Math.round(v*1000);apply(v);}
const playBtn=$('play');
function stopPlay(){playing=false;tgt=null;playBtn.textContent='تشغيل';}
playBtn.onclick=()=>{if(playing){stopPlay();return;}playing=true;playBtn.textContent='إيقاف';tgt=null;if(+slider.value>=1000)setS(0);};
['tCore','tOuter','tConc'].forEach(id=>$(id).onchange=applyVis);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);
let last=performance.now();
function loop(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  let v=+slider.value/1000;
  if(playing){v+=dt*(reduce?1:.14);if(v>=1){v=1;stopPlay();}setS(v);}
  else if(tgt!==null){const dv=tgt-v;if(Math.abs(dv)<.004||reduce){setS(tgt);tgt=null;}else setS(v+Math.sign(dv)*Math.min(Math.abs(dv),dt*.5));}
  controls.update();renderer.render(scene,camera);requestAnimationFrame(loop);
}
limitY();syncA();syncB();outs();build(true);resize();requestAnimationFrame(loop);
})();