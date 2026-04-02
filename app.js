const PAGE_SIZE = 5;
const API_BASE = 'http://192.168.1.161:8010';
const STORAGE_KEY = 'cccd_records_current_user';
const els = {
  authSection: document.getElementById('authSection'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  loginBtn: document.getElementById('loginBtn'),
  loginStatus: document.getElementById('loginStatus'),
  userBar: document.getElementById('userBar'),
  currentUserLabel: document.getElementById('currentUserLabel'),
  logoutBtn: document.getElementById('logoutBtn'),
  recordsPanel: document.getElementById('recordsPanel'),
  detailPanel: document.getElementById('detailPanel'),
  searchInput: document.getElementById('searchInput'),
  fromDateInput: document.getElementById('fromDateInput'),
  toDateInput: document.getElementById('toDateInput'),
  searchBtn: document.getElementById('searchBtn'),
  exportExcelBtn: document.getElementById('exportExcelBtn'),
  tableBody: document.getElementById('tableBody'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageInfo: document.getElementById('pageInfo'),
  detailContent: document.getElementById('detailContent'),
  extraEmailInput: document.getElementById('extraEmailInput'),
  sendEmailBtn: document.getElementById('sendEmailBtn'),
  copyJsonBtn: document.getElementById('copyJsonBtn'),
  printBtn: document.getElementById('printBtn'),
  printCatalogBtn: document.getElementById('printCatalogBtn'),
  deleteBtn: document.getElementById('deleteBtn')
};
let allItems = [];
let currentPage = 1;
let currentItem = null;
let currentUser = null;

function api(path){return `${API_BASE}${path}`;}
function esc(v){return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function setLoginStatus(text,type='info'){els.loginStatus.className=`status ${type}`;els.loginStatus.textContent=text;}
function applyAuthState(){
  const saved = localStorage.getItem(STORAGE_KEY);
  currentUser = saved ? JSON.parse(saved) : null;
  const loggedIn = !!currentUser;
  els.authSection.classList.toggle('hidden', loggedIn);
  els.userBar.classList.toggle('hidden', !loggedIn);
  els.recordsPanel.classList.toggle('hidden', !loggedIn);
  els.detailPanel.classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    els.currentUserLabel.textContent = `Đang đăng nhập: ${currentUser.username}${currentUser.role === 'admin' ? ' (admin)' : ''}`;
    els.deleteBtn.classList.toggle('hidden', currentUser.role !== 'admin');
  }
}
function formatDateTime(v){
  if(!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).replace('T',' ').slice(0,16);
  return new Intl.DateTimeFormat('vi-VN', { timeZone:'Asia/Ho_Chi_Minh', hour12:false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(d).replace(',', '');
}
function formatTodayVi(){
  const d = new Date();
  return { day: String(d.getDate()).padStart(2,'0'), month: String(d.getMonth()+1).padStart(2,'0'), year: String(d.getFullYear()) };
}
function toTitleCaseVietnamese(v){return String(v||'').toLowerCase().split(/\s+/).filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');}
function toAsciiPreserveCase(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');}
function parseDdMmYyyy(value){const m=String(value||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(!m) return null; return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));}
function formatDdMmYyyy(d){const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear(); return `${dd}/${mm}/${yyyy}`;}
function calcExpireDate(dobText){const dob=parseDdMmYyyy(dobText); if(!dob) return ''; const today=new Date(); let age=today.getFullYear()-dob.getFullYear(); const hadBirthday=(today.getMonth()>dob.getMonth()) || (today.getMonth()===dob.getMonth() && today.getDate()>=dob.getDate()); if(!hadBirthday) age-=1; if(age<12) return formatDdMmYyyy(new Date(dob.getFullYear()+14,dob.getMonth(),dob.getDate())); if(age<23) return formatDdMmYyyy(new Date(dob.getFullYear()+25,dob.getMonth(),dob.getDate())); if(age<38) return formatDdMmYyyy(new Date(dob.getFullYear()+40,dob.getMonth(),dob.getDate())); if(age<58) return formatDdMmYyyy(new Date(dob.getFullYear()+60,dob.getMonth(),dob.getDate())); return '31/12/9999';}
function getIssuePlaceCode(issueDateText){const issueDate=parseDdMmYyyy(issueDateText); const cutoff=new Date(2024,6,1); if(!issueDate) return '318'; return issueDate < cutoff ? '318' : '004';}
function toJsonShape(x){const titleName=toTitleCaseVietnamese(x.full_name||'');const shortName=titleName;const shortNameEnglish=toAsciiPreserveCase(titleName);return {full_name:titleName,full_name_english:toAsciiPreserveCase(titleName),short_name:shortName,short_name_english:shortNameEnglish,date_of_birth:x.date_of_birth||'',gender:x.gender||'',mobile_phone:x.phone_number||'',email:'',idcard_num:x.id_number||'',idcard_issue_date:x.issue_date||'',idcard_expire_date:calcExpireDate(x.date_of_birth||''),nationality:'VN',id_type:'GTTT',issue_place_code:getIssuePlaceCode(x.issue_date||''),occupation:x.occupation||'Kinh doanh tự do',address:x.current_address||''};}
function imageOrPlaceholder(url,label){return url?`<img class="detail-original-image" data-enhance="card" src="${esc(url)}" alt="${esc(label)}">`:`<div class="muted">Chưa có ảnh</div>`;}

function loadImage(url){return new Promise((resolve,reject)=>{fetch(url).then(r=>{if(!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.blob();}).then(blob=>{const objectUrl=URL.createObjectURL(blob); const img=new Image(); img.onload=()=>{URL.revokeObjectURL(objectUrl);resolve(img);}; img.onerror=()=>reject(new Error(`Image decode failed: ${url}`)); img.src=objectUrl;}).catch(reject);});}
function enhanceCardImage(img, mode='card'){const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d',{willReadFrequently:true});const sw=img.naturalWidth||img.width;const sh=img.naturalHeight||img.height;canvas.width=mode==='card'?1100:900;canvas.height=mode==='card'?700:900;ctx.drawImage(img,0,0,sw,sh,0,0,canvas.width,canvas.height);const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);const d=imageData.data;const contrast=mode==='card'?1.28:1.18;const brightness=mode==='card'?10:8;for(let i=0;i<d.length;i+=4){d[i]=Math.max(0,Math.min(255,((d[i]-128)*contrast)+128+brightness));d[i+1]=Math.max(0,Math.min(255,((d[i+1]-128)*contrast)+128+brightness));d[i+2]=Math.max(0,Math.min(255,((d[i+2]-128)*contrast)+128+brightness));}ctx.putImageData(imageData,0,0);return canvas.toDataURL('image/jpeg',0.92);}

async function login(){
  try {
    const res = await fetch(api('/api/auth/login'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username: els.loginUsername.value.trim(), password: els.loginPassword.value }) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json?.detail || 'Đăng nhập thất bại');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(json.user));
    applyAuthState();
    setLoginStatus('Đăng nhập thành công.','success');
    await loadList();
  } catch (e) { setLoginStatus(String(e),'error'); }
}
function logout(){ localStorage.removeItem(STORAGE_KEY); currentUser=null; currentItem=null; applyAuthState(); }

async function loadList(){
  const q = encodeURIComponent(els.searchInput.value.trim());
  const fromDate = (els.fromDateInput.value || '').trim();
  const toDate = (els.toDateInput.value || '').trim();
  const query = [`q=${q}`,(fromDate?`from_date=${encodeURIComponent(fromDate)}`:''),(toDate?`to_date=${encodeURIComponent(toDate)}`:'')].filter(Boolean).join('&');
  const res = await fetch(api(`/api/cccd/records${query?`?${query}`:''}`));
  const json = await res.json();
  allItems = json.items || [];
  currentPage = 1;
  if (currentItem) currentItem = allItems.find(x => x.id === currentItem.id) || null;
  renderTable();
  if (currentItem) showDetail(currentItem); else els.detailContent.textContent = 'Chọn một hồ sơ để xem chi tiết.';
}

function renderTable(){
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = allItems.slice(start, start + PAGE_SIZE);
  els.tableBody.innerHTML = pageItems.map((item, idx) => `\n    <tr data-id="${esc(item.id)}">\n      <td>${start + idx + 1}</td>\n      <td>${esc(item.full_name || '')}</td>\n      <td>${esc(item.id_number || '')}</td>\n      <td>${esc(item.date_of_birth || '')}</td>\n      <td>${esc(item.phone_number || '')}</td>\n      <td>${esc(item.created_by || '')}</td>\n      <td>${esc(formatDateTime(item.created_at))}</td>\n    </tr>\n  `).join('') || '<tr><td colspan="7" class="muted">Chưa có hồ sơ nào.</td></tr>';
  [...els.tableBody.querySelectorAll('tr[data-id]')].forEach((tr) => {
    if (currentItem && currentItem.id === tr.dataset.id) tr.classList.add('selected');
    tr.onclick = () => { const item = allItems.find(x => x.id === tr.dataset.id); if (item) showDetail(item); };
  });
  els.pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
  els.prevPageBtn.disabled = currentPage <= 1;
  els.nextPageBtn.disabled = currentPage >= totalPages;
}

async function enhanceDetailImages() { const imgs = Array.from(document.querySelectorAll('.detail-original-image')); for (const imgEl of imgs) { try { const img = await loadImage(imgEl.src); imgEl.src = enhanceCardImage(img, 'card'); } catch (_) {} } }
function showDetail(item){ currentItem = item; renderTable(); els.deleteBtn.classList.toggle('hidden', !(currentUser?.role === 'admin')); const jsonText = JSON.stringify(toJsonShape(item), null, 2); els.detailContent.innerHTML = `\n    <div class="detail-grid">\n      <div class="detail-box"><label>Họ và tên</label>${esc(item.full_name)}</div>\n      <div class="detail-box"><label>Số CCCD</label>${esc(item.id_number)}</div>\n      <div class="detail-box"><label>Ngày sinh</label>${esc(item.date_of_birth)}</div>\n      <div class="detail-box"><label>Giới tính</label>${esc(item.gender)}</div>\n      <div class="detail-box"><label>Số điện thoại</label>${esc(item.phone_number)}</div>\n      <div class="detail-box"><label>Ngày thu thập</label>${esc(formatDateTime(item.created_at))}</div>\n      <div class="detail-box"><label>Nghề nghiệp</label>${esc(item.occupation)}</div>\n      <div class="detail-box"><label>Địa chỉ hiện tại</label>${esc(item.current_address)}</div>\n    </div>\n    <div class="image-grid">\n      <div class="image-card"><span>Mặt trước</span>${imageOrPlaceholder(item.front_image_url, 'Mặt trước')}</div>\n      <div class="image-card"><span>Mặt sau</span>${imageOrPlaceholder(item.back_image_url, 'Mặt sau')}</div>\n      <div class="image-card"><span>Mã QR</span>${imageOrPlaceholder(item.generated_qr_image_url || item.qr_image_url, 'Mã QR')}</div>\n    </div>\n    <div class="detail-box json-box"><label>JSON chuẩn</label>${esc(jsonText)}</div>\n  `; enhanceDetailImages(); }

function exportExcel(){ const rows = allItems.map((item, idx) => ({ STT: idx + 1, 'Họ tên': item.full_name || '', 'Số CCCD': item.id_number || '', 'Ngày sinh': item.date_of_birth || '', 'Giới tính': item.gender || '', 'Số điện thoại': item.phone_number || '', 'Ngày thu thập': formatDateTime(item.created_at) })); const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'CCCD Records'); XLSX.writeFile(wb, 'danh_sach_ho_so_cccd.xlsx'); }

async function deleteCurrentRecord(){
  if (!currentItem || currentUser?.role !== 'admin') return;
  if (!confirm(`Xoá hồ sơ ${currentItem.full_name || currentItem.id_number}?`)) return;
  const res = await fetch(api(`/api/cccd/records/${encodeURIComponent(currentItem.id)}`), {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username, password: prompt('Nhập lại mật khẩu admin để xoá:') || '' })
  });
  const json = await res.json();
  if (!res.ok || !json.success) return alert(json?.detail || 'Xoá thất bại');
  currentItem = null;
  await loadList();
  alert('Đã xoá bản ghi.');
}

async function downloadCatalog(){
  if (!currentItem) return alert('Chọn một hồ sơ trước.');
  const url = api(`/api/cccd/records/${encodeURIComponent(currentItem.id)}/catalog-docx`);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.click();
}

els.loginBtn.addEventListener('click', login);
els.logoutBtn.addEventListener('click', logout);
els.searchBtn.addEventListener('click', loadList);
els.exportExcelBtn.addEventListener('click', exportExcel);
els.prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; renderTable(); } });
els.nextPageBtn.addEventListener('click', () => { if (currentPage < Math.ceil(allItems.length / PAGE_SIZE)) { currentPage += 1; renderTable(); } });
els.sendEmailBtn.addEventListener('click', async () => { if (!currentItem) return alert('Chọn một hồ sơ trước.'); try { const res = await fetch(api('/api/cccd/send-email'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record_id: currentItem.id, extra_email: els.extraEmailInput.value.trim() }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json?.detail || 'Gửi email thất bại'); alert(`Đã gửi email tới: ${json.sent_to.join(', ')}`); } catch (e) { alert(String(e)); } });
els.copyJsonBtn.addEventListener('click', async () => { if(!currentItem) return; const text = JSON.stringify(toJsonShape(currentItem), null, 2); try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); } else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } alert('Đã copy JSON.'); } catch (e) { alert('Không copy được JSON.'); } });
els.printBtn.addEventListener('click', () => { if (!currentItem) return alert('Chọn một hồ sơ trước.'); const url = `print.html?id=${encodeURIComponent(currentItem.id)}`; window.open(url, '_blank', 'noopener,noreferrer'); });
els.printCatalogBtn.addEventListener('click', downloadCatalog);
els.deleteBtn.addEventListener('click', deleteCurrentRecord);
applyAuthState();
if (currentUser) loadList();
