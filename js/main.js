'use strict';
/* =====================================================================
   ABSTRACTS — main.js
   Bootstrap: deck-select screen and debug handle.
   ===================================================================== */

function sigilSvg(archKey){
  const a=ARCH[archKey];
  const pts=a.angles.map(ang=>{
    const r=40,rad=ang*Math.PI/180;
    return (50+r*Math.cos(rad)).toFixed(1)+','+(50+r*Math.sin(rad)).toFixed(1);
  });
  let s=`<svg viewBox="0 0 100 100"><polygon points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  a.angles.forEach(ang=>{
    const r=40,rad=ang*Math.PI/180;
    s+=`<line x1="50" y1="50" x2="${(50+r*Math.cos(rad)).toFixed(1)}" y2="${(50+r*Math.sin(rad)).toFixed(1)}" stroke="var(--accent)" stroke-opacity=".4" stroke-width="1"/>`;
    s+=`<circle cx="${(50+r*Math.cos(rad)).toFixed(1)}" cy="${(50+r*Math.sin(rad)).toFixed(1)}" r="3.5" fill="var(--accent)"/>`;
  });
  s+=`<circle cx="50" cy="50" r="6" fill="var(--accent)"/></svg>`;
  return s;
}

(function buildSelect(){
  const row=document.getElementById('pick-row');
  row.innerHTML=Object.keys(ARCH).map(k=>{
    const a=ARCH[k];
    return `<div class="pick ${a.css}" data-arch="${k}">
      ${sigilSvg(k)}
      <h2>${a.name}</h2>
      <p>${a.blurb}</p>
      <span class="geo">${a.desc}</span>
    </div>`;
  }).join('');
  row.querySelectorAll('.pick').forEach(el=>el.addEventListener('click',()=>newGame(el.dataset.arch)));
})();

/* Debug / test handle — inspect game state from the console as `Abstracts` */
window.Abstracts = {
  get G(){ return G; },
  get ui(){ return ui; },
  CARDS, ARCH, NODE_FX, getUnit, unitRefs, newGame
};
