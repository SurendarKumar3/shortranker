// Simple test script to call the running Next dev server
const payload = {
  videos: [{ tempId: 'abc123', title: 'Amazing Clip', rank: 1 }],
  topic: 'gaming highlights',
  options: { style: 'energetic', includeEmojis: false, useLLM: false }
};

function wait(ms){return new Promise(r=>setTimeout(r,ms));}

(async function(){
  const base = 'http://localhost:3001';
  for(let i=0;i<12;i++){
    try{
      const h = await fetch(base + '/');
      console.log('HOME', h.status);
      const res = await fetch(base + '/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      console.log('API STATUS', res.status);
      console.log('API BODY:', text);
      process.exit(0);
    }catch(err){
      console.error('Attempt', i+1, 'failed:', err.message);
      await wait(500);
    }
  }
  console.error('Could not contact server after retries');
  process.exit(2);
})();
