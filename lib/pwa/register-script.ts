/** Inline registrar for /sw.js. Hashed into script-src so it can run without 'unsafe-inline'. */
export const SERVICE_WORKER_BOOT_SCRIPT = `(function(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){});
  });
})();`;
