(function(){
  const s = document.currentScript;
  const cid = s.dataset.campaign;
  const host = s.src.split('/embed.js')[0];
  const mountId = 'yourapp-embed';
  const el = document.getElementById(mountId);
  if(!el){ console.warn('[embed] Missing #yourapp-embed container'); return; }
  const ifr = document.createElement('iframe');
  ifr.src = host + '/embed/' + cid;
  ifr.style.width = '100%';
  ifr.style.height = '700px';
  ifr.style.border = '0';
  el.appendChild(ifr);
  window.addEventListener('message', (e)=>{
    // reserved for Day 2 eventing (INTERVIEW_COMPLETE, etc.)
  });
})();
