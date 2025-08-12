const DB_NAME = 'demotube-db';
const STORE = 'videos';

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE)){
        const os = db.createObjectStore(STORE, {keyPath:'id', autoIncrement:true});
        os.createIndex('title','title',{unique:false});
        os.createIndex('filename','filename',{unique:false});
      }
    }
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  })
}

async function addVideo(blob, filename, title){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,'readwrite');
    const store = tx.objectStore(STORE);
    const meta = {blob, filename, title, created: Date.now()};
    const rq = store.add(meta);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = e => reject(e.target.error);
  })
}

async function getAllVideos(){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,'readonly');
    const store = tx.objectStore(STORE);
    const rq = store.getAll();
    rq.onsuccess = ()=> resolve(rq.result);
    rq.onerror = e=> reject(e.target.error);
  })
}

async function deleteVideo(id){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,'readwrite');
    const store = tx.objectStore(STORE);
    const rq = store.delete(id);
    rq.onsuccess = ()=> resolve();
    rq.onerror = e=> reject(e.target.error);
  })
}

// UI elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const videoGrid = document.getElementById('videoGrid');
const overlay = document.getElementById('overlay');
const playerVideo = document.getElementById('playerVideo');
const playerTitle = document.getElementById('playerTitle');
const playerFilename = document.getElementById('playerFilename');
const closePlayer = document.getElementById('closePlayer');
const deleteBtn = document.getElementById('deleteBtn');
const newUpload = document.getElementById('newUpload');
const search = document.getElementById('search');

let currentPlaying = null;

// Drag & Drop
function preventDefaults(e){e.preventDefault();e.stopPropagation();}
['dragenter','dragover','dragleave','drop'].forEach(ev=>{
  dropZone.addEventListener(ev,preventDefaults, false)
})
dropZone.addEventListener('dragover', ()=> dropZone.classList.add('dragover'))
dropZone.addEventListener('dragleave', ()=> dropZone.classList.remove('dragover'))
dropZone.addEventListener('drop', async (e)=>{
  dropZone.classList.remove('dragover')
  const files = Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('video/'));
  await handleFiles(files);
})

fileInput.addEventListener('change', async (e)=>{
  const files = Array.from(e.target.files).filter(f=>f.type.startsWith('video/'));
  await handleFiles(files);
  fileInput.value = '';
})

newUpload.addEventListener('click', ()=> fileInput.click())

async function handleFiles(files){
  for(const f of files){
    const title = prompt('Title for this video (optional):', f.name) || f.name;
    const blob = await f.slice(0);
    await addVideo(blob, f.name, title);
  }
  await refreshGrid();
}

async function refreshGrid(){
  const q = search.value.trim().toLowerCase();
  const items = await getAllVideos();
  videoGrid.innerHTML = '';
  if(!items.length){
    videoGrid.innerHTML = '<div style="grid-column:1/-1;color:#9fb0c9;padding:40px;text-align:center">No videos yet — drop some or click Upload.</div>';
    return;
  }
  for(const item of items.reverse()){
    if(q && !((item.title||'').toLowerCase().includes(q) || (item.filename||'').toLowerCase().includes(q))) continue;
    const card = document.createElement('div'); card.className = 'card';
    const thumb = document.createElement('div'); thumb.className = 'thumb';
    const vid = document.createElement('video');
    vid.src = URL.createObjectURL(item.blob);
    vid.muted = true; vid.playsInline = true; vid.preload = 'metadata';
    thumb.appendChild(vid);
    const meta = document.createElement('div'); meta.className = 'meta';
    const t = document.createElement('div');
    t.innerHTML = `<div class="title">${escapeHtml(item.title||'Untitled')}</div><div class="small">${escapeHtml(item.filename||'')}</div>`;
    const actions = document.createElement('div');
    const playBtn = document.createElement('button'); playBtn.className='btn'; playBtn.textContent='Play';
    playBtn.onclick = ()=> openPlayer(item.id);
    const delBtn = document.createElement('button'); delBtn.className='btn'; delBtn.textContent='Remove';
    delBtn.onclick = async ()=>{ if(confirm('Delete this video from your browser storage?')){ await deleteVideo(item.id); await refreshGrid(); } }
    actions.append(playBtn, delBtn);
    meta.appendChild(t); meta.appendChild(actions);
    card.appendChild(thumb); card.appendChild(meta);
    videoGrid.appendChild(card);
  }
}

async function openPlayer(id){
  const db = await openDB();
  const tx = db.transaction(STORE,'readonly');
  const store = tx.objectStore(STORE);
  const rq = store.get(id);
  rq.onsuccess = ()=>{
    const item = rq.result;
    if(!item) return alert('Video not found');
    currentPlaying = id;
    playerVideo.src = URL.createObjectURL(item.blob);
    playerTitle.textContent = item.title || 'Untitled';
    playerFilename.textContent = item.filename || '';
    overlay.classList.add('show');
  }
}

closePlayer.addEventListener('click', ()=>{
  overlay.classList.remove('show');
  playerVideo.pause();
  playerVideo.src = '';
  currentPlaying = null;
})

deleteBtn.addEventListener('click', async ()=>{
  if(currentPlaying && confirm('Delete this video from your browser?')){
    await deleteVideo(currentPlaying);
    overlay.classList.remove('show');
    playerVideo.pause();
    playerVideo.src='';
    currentPlaying = null;
    await refreshGrid();
  }
})

search.addEventListener('input', ()=> refreshGrid())

function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }

(async ()=>{ await refreshGrid(); })();
