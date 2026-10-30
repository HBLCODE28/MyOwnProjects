(() => {
  'use strict';
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  const stage = document.getElementById('playground');
  const layer = document.getElementById('blobs-layer');
  const list = document.getElementById('projects-list');
  const overlay = document.getElementById('project-overlay');
  const bg = document.getElementById('overlay-blob');
  const inner = document.getElementById('overlay-inner');
  const closeButton = document.getElementById('overlay-close');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shapes = [];
  const colors = ['#D88180', '#CAD182', '#F7B1B0', '#FEEAC7', '#C9A17C'];
  const radii = [
    '52% 48% 39% 61% / 53% 35% 65% 47%',
    '39% 61% 54% 46% / 61% 43% 57% 39%',
    '58% 42% 62% 38% / 44% 55% 45% 56%',
    '46% 54% 36% 64% / 63% 42% 58% 37%',
    '61% 39% 47% 53% / 52% 62% 38% 48%'
  ];
  let active = null, lastFocus = null, closing = false;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isSafeUrl = value => {
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol); }
    catch { return false; }
  };
  const escapeAttr = value => String(value).replace(/[&"'<>]/g, c => ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[c]));

  function setupStage() {
    const w = stage.clientWidth;
    const cols = Math.max(1, Math.floor(w / (w < 550 ? 200 : 260)));
    const rows = Math.ceil(projects.length / cols);
    const rowHeight = w < 550 ? 225 : 250;
    const height = Math.max(w < 550 ? 550 : 580, rows * rowHeight + 150);
    stage.style.height = `${height}px`;
    return {w, h: height, cols, rowHeight};
  }

  function positionShapes() {
    const {w, h, cols, rowHeight} = setupStage();
    shapes.forEach((s, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const itemsThisRow = Math.min(cols, projects.length - row * cols);
      const cellWidth = w / itemsThisRow;
      const stagger = (i % 3 - 1) * Math.min(35, w * .04);
      s.size = Math.min(w < 550 ? 185 : 220, Math.max(145, cellWidth * .72));
      s.x = clamp((col + .5) * cellWidth - s.size / 2 + stagger, 12, w - s.size - 12);
      s.y = clamp(78 + row * rowHeight + (i % 2) * 24, 12, h - s.size - 12);
      s.baseX = s.x; s.baseY = s.y;
      s.el.style.setProperty('--size', `${s.size}px`);
      s.el.style.setProperty('--x', `${s.x}px`);
      s.el.style.setProperty('--y', `${s.y}px`);
    });
  }

  function addShape(project, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-blob';
    button.setAttribute('aria-label', `פתיחת הפרויקט ${project.title}`);
    button.style.setProperty('--blob-color', project.color || colors[index % colors.length]);
    button.style.setProperty('--radius', radii[index % radii.length]);
    button.style.setProperty('--rotate', `${(index % 5 - 2) * 5}deg`);
    const symbol = document.createElement('span');symbol.className = 'blob-symbol';symbol.setAttribute('aria-hidden','true');symbol.textContent = project.symbol || '✳';
    const title = document.createElement('span');title.className = 'blob-title';title.textContent = project.title || 'פרויקט';
    const subtitle = document.createElement('span');subtitle.className = 'blob-subtitle';subtitle.textContent = project.subtitle || '';
    const open = document.createElement('span');open.className = 'blob-open';open.textContent = 'לגלות ↗';
    button.append(symbol,title,subtitle,open); layer.append(button);
    const state = {el:button,project,x:0,y:0,baseX:0,baseY:0,size:0,vx:0,vy:0,dragging:false,hold:false};
    shapes.push(state);
    let drag = null;
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0 || active) return;
      drag = {id:e.pointerId,startX:e.clientX,startY:e.clientY,x:state.x,y:state.y,moved:false,t:performance.now()};
      button.setPointerCapture(e.pointerId);state.hold=true;
    });
    button.addEventListener('pointermove',e=>{
      if (!drag || e.pointerId !== drag.id) return;
      const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
      if(Math.hypot(dx,dy)>7)drag.moved=true;
      if(!drag.moved)return;
      state.dragging=true;
      const rect=stage.getBoundingClientRect();
      const nx=clamp(drag.x+dx,0,rect.width-state.size),ny=clamp(drag.y+dy,0,rect.height-state.size);
      state.vx=(nx-state.x)*.4;state.vy=(ny-state.y)*.4;
      state.x=nx;state.y=ny;
      updateShape(state);
    });
    const finish = e => {
      if(!drag || e.pointerId!==drag.id)return;
      const moved=drag.moved;
      drag=null;state.dragging=false;state.hold=false;
      if(!moved && e.type==='pointerup'){button.dataset.justClicked='true';openProject(project,button);}
    };
    button.addEventListener('pointerup',finish);
    button.addEventListener('pointercancel',finish);
    button.addEventListener('click',()=>{if(button.dataset.justClicked){delete button.dataset.justClicked;return;}openProject(project,button);});
    const item=document.createElement('button');item.type='button';item.textContent=`${project.title} ↗`;item.addEventListener('click',()=>openProject(project,button));list.append(item);
  }
  function updateShape(s){s.el.style.setProperty('--x',`${s.x}px`);s.el.style.setProperty('--y',`${s.y}px`);}

  function physics(){
    if(!reduceMotion.matches && !active){
      const w=stage.clientWidth,h=stage.clientHeight,t=performance.now()/1000;
      shapes.forEach((s,i)=>{
        if(s.hold)return;
        const dx=(s.baseX+Math.sin(t*.45+i*1.9)*17)-s.x;
        const dy=(s.baseY+Math.cos(t*.5+i*2.2)*15)-s.y;
        s.vx=(s.vx+dx*.003)*.95;s.vy=(s.vy+dy*.003)*.95;
        s.x=clamp(s.x+s.vx,0,w-s.size);s.y=clamp(s.y+s.vy,0,h-s.size);
        updateShape(s);
      });
    }
    requestAnimationFrame(physics);
  }

  function makeLink(label, url){
    if(!isSafeUrl(url))return;
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${label} ↗`;document.getElementById('overlay-links').append(a);
  }
  function openProject(project, trigger){
    if(active||closing)return;
    active={project,trigger};lastFocus=document.activeElement;
    document.getElementById('overlay-title').textContent=project.title||'';
    document.getElementById('overlay-description').textContent=project.description||'';
    const tags=document.getElementById('overlay-tags');tags.replaceChildren();
    (project.technologies||[]).forEach(tag=>{const span=document.createElement('span');span.textContent=tag;tags.append(span);});
    document.getElementById('overlay-links').replaceChildren();
    makeLink('לצפייה באתר',project.website);makeLink('GitHub',project.github);
    overlay.style.setProperty('--overlay-color',project.color||colors[0]);
    overlay.classList.add('is-visible');overlay.setAttribute('aria-hidden','false');document.body.classList.add('is-overlay-open');
    const rect=trigger.getBoundingClientRect();
    const start={left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,borderRadius:getComputedStyle(trigger).borderRadius};
    const end={left:'0px',top:'0px',width:`${inner.clientWidth}px`,height:`${inner.clientHeight}px`,borderRadius:'0px'};
    bg.style.opacity='1';
    if(reduceMotion.matches){Object.assign(bg.style,end);inner.style.opacity='1';}
    else{
      bg.animate([start,end],{duration:730,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      inner.animate([{opacity:0,transform:'translateY(23px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,delay:380,easing:'ease-out',fill:'forwards'});
    }
    setTimeout(()=>{inner.style.opacity='1';closeButton.focus();},reduceMotion.matches?0:710);
  }
  function closeProject(){
    if(!active||closing)return;closing=true;
    const trigger=active.trigger;
    const done=()=>{
      overlay.classList.remove('is-visible');overlay.setAttribute('aria-hidden','true');document.body.classList.remove('is-overlay-open');
      bg.getAnimations().forEach(a=>a.cancel());inner.getAnimations().forEach(a=>a.cancel());
      bg.removeAttribute('style');inner.style.opacity='0';
      active=null;closing=false;
      if(lastFocus&&lastFocus.isConnected)lastFocus.focus();else trigger.focus();
    };
    if(reduceMotion.matches){done();return;}
    const rect=trigger.getBoundingClientRect();
    const to={left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,borderRadius:getComputedStyle(trigger).borderRadius};
    bg.getAnimations().forEach(a=>a.cancel());inner.getAnimations().forEach(a=>a.cancel());
    bg.animate([{left:'0px',top:'0px',width:'100%',height:'100%',borderRadius:'0px'},to],{duration:490,easing:'cubic-bezier(.65,0,.75,.25)',fill:'forwards'}).onfinish=done;
    inner.animate([{opacity:1},{opacity:0}],{duration:140,fill:'forwards'});
  }
  closeButton.addEventListener('click',closeProject);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProject();if(e.key==='Tab'&&active){const targets=[closeButton,...inner.querySelectorAll('a[href]')];const first=targets[0],last=targets[targets.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  document.getElementById('year').textContent=new Date().getFullYear();
  if(!projects.length){layer.innerHTML='<p class="empty-message">עוד מעט יהיו כאן פרויקטים...</p>';}
  else{projects.forEach(addShape);}
  positionShapes();
  window.addEventListener('resize',()=>{if(!active)positionShapes();});
  requestAnimationFrame(physics);
})();
// Hero Typing Animation

function startTypingAnimation() {
    const textElement = document.getElementById("typing-text");
    const cursor = document.querySelector(".typing-cursor");

    if (!textElement || !cursor) return;

    const text = "Hila.";
    const typingSpeed = 180;
    const startDelay = 500;

    let index = 0;

    // Accessibility: skip animation if reduced motion is enabled
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        textElement.innerHTML = 'Hila<span class="typed-dot">.</span>';
        cursor.classList.add("finished");
        return;
    }

    function typeNextCharacter() {
        if (index < text.length) {
            const char = text[index];

            if (char === ".") {
                const dot = document.createElement("span");
                dot.className = "typed-dot";
                dot.textContent = ".";
                textElement.appendChild(dot);
            } else {
                textElement.appendChild(document.createTextNode(char));
            }

            index++;

            setTimeout(typeNextCharacter, typingSpeed);
        } else {
            // Hide cursor after typing finishes
            setTimeout(() => {
                cursor.classList.add("finished");
            }, 1000);
        }
    }

    setTimeout(typeNextCharacter, startDelay);
}

startTypingAnimation();