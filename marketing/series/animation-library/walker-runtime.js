/* Shared articulated walk cycle: IK knees, planted feet, arm swing and weight shift. */
function renderWalkers(t){
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v)},mix=(a,b,p)=>a+(b-a)*p;
 for(const actor of document.querySelectorAll('.episode-walker')){
  const shot=actor.closest('.shot');if(!shot||shot.style.visibility==='hidden')continue;
  const start=+shot.dataset.start,end=+shot.dataset.end,span=Math.max(.1,end-start),travel=+actor.dataset.travel||0,dir=+actor.dataset.direction||1,scale=+actor.dataset.scale,cx=+actor.dataset.x,baseY=+actor.dataset.y,seed=+actor.dataset.phase||0,cycle=+actor.dataset.cycle||.86,id=actor.dataset.id;
  const moveDuration=Math.min(3.2,Math.max(.7,span*.72)),localT=clamp(t-start,0,moveDuration),progress=travel?smooth(localT/moveDuration):0,elapsed=t-start,approach=id==='customer14'?smooth(clamp(elapsed/3.1)):0,leave=id==='customer14'?smooth(clamp((elapsed-9.2)/2.4)):0,distance=id==='customer14'?240*approach+460*leave:travel*progress,x=id==='customer14'?cx-240*approach+460*leave:cx+dir*distance;
  const moving=id==='customer14'?(elapsed<3.1||(elapsed>9.2&&elapsed<11.6)):(travel&&progress<1),settle=id==='customer14'?(moving?0:1):(travel?smooth((t-start-moveDuration)/.24):1),stepFade=1-settle;
  // Advance the gait from travelled distance, respecting direction and each worker's cadence.
  // This keeps the planted foot fixed in world space for both left-to-right and right-to-left walks.
  const stride=112*cycle,phase=((dir*distance/(stride*scale)+seed)%1+1)%1,phaseL=phase,phaseR=(phase+.5)%1;
  const gait=travel?Math.sin(phase*2*Math.PI):0,bob=travel?Math.abs(gait)*2.1*stepFade:0;
  actor.setAttribute('transform','translate('+(x-250*scale)+' '+(baseY-449*scale)+') scale('+scale+')');
  const torso=document.getElementById(id+'-torso');if(torso)torso.setAttribute('transform','translate(0 '+bob+')');
  function pose(p,hip,lead){let phaseX,lift;const footStride=stride*.62;if(p<.62){phaseX=lead-footStride*(p/.62);lift=0}else{const q=(p-.62)/.38;phaseX=lead-footStride+footStride*smooth(q);lift=Math.sin(Math.PI*q)*34}const idleX=lead-footStride*.22;phaseX=mix(idleX,phaseX,stepFade);lift*=stepFade;const ankleX=hip+phaseX,ankleY=445-lift,hipY=350+bob,dx=ankleX-hip,dy=ankleY-hipY,distance=Math.max(1,Math.hypot(dx,dy)),upperLength=55,lowerLength=55,along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along)),ux=dx/distance,uy=dy/distance,bend=dir>0?-1:1,kneeX=hip+ux*along+(-uy)*height*bend,kneeY=hipY+uy*along+ux*height*bend;return{ankleX,ankleY,kneeX,kneeY,lift,hipY}}
  function path(id,d){const n=document.getElementById(id);if(n)n.setAttribute('d',d)}
  function leg(side,hip,p){const prefix=id+'-'+side;const upper='M'+hip+' '+p.hipY+'L'+p.kneeX+' '+p.kneeY,lower='M'+p.kneeX+' '+p.kneeY+'L'+p.ankleX+' '+p.ankleY;path(prefix+'UpperOutline',upper);path(prefix+'Upper',upper);path(prefix+'LowerOutline',lower);path(prefix+'Lower',lower);path(prefix+'Shoe','M'+(p.ankleX-29)+' '+(449-p.lift)+'h36')}
  const lead=stride*.31,L=pose(phaseL,222,lead),R=pose(phaseR,278,lead);leg('left',222,L);leg('right',278,R);
  function arm(side,shoulderX,swing){const left=side==='left',elbowX=(left?174:326)+swing*10,elbowY=250+Math.abs(swing)*2,wristX=(left?178:322)+swing*17,wristY=337+swing*3;const pre=id+'-'+side;const upper='M'+shoulderX+' 192 Q'+mix(shoulderX,elbowX,.5)+' '+mix(192,elbowY,.5)+' '+elbowX+' '+elbowY,lower='M'+elbowX+' '+elbowY+' Q'+mix(elbowX,wristX,.5)+' '+mix(elbowY,wristY,.5)+' '+wristX+' '+wristY;path(pre+'UpperArmOutline',upper);path(pre+'UpperArm',upper);path(pre+'ForearmOutline',lower);path(pre+'Forearm',lower);const hand=document.getElementById(pre+'Hand');if(hand){hand.setAttribute('cx',wristX);hand.setAttribute('cy',wristY+4)}}
  arm('left',190,-Math.sin(phaseR*2*Math.PI)*stepFade);arm('right',310,-Math.sin(phaseL*2*Math.PI)*stepFade);
  const head=document.getElementById(id+'-head');if(head)head.setAttribute('transform','rotate('+(-gait*.8*stepFade)+' 250 105)');
  for(const [eye,shift] of [['eyeL',Math.sin((t-start)*1.1+seed)*1.1],['eyeR',Math.sin((t-start)*1.1+seed)*1.1]]){const node=document.getElementById(id+'-'+eye);if(node)node.setAttribute('cy',106+shift)}
 }
}
