const PAGE_SIZE = 5;
const API_BASE = 'http://192.168.1.161:8010';
const els = {
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
  printBtn: document.getElementById('printBtn')
};
let allItems = [];
let currentPage = 1;
let currentItem = null;

function api(path){return `${API_BASE}${path}`;}
function esc(v){return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function formatDateTime(v){if(!v) return ''; return String(v).replace('T',' ').slice(0,16);}
function toTitleCaseVietnamese(v){return String(v||'').toLowerCase().split(/\s+/).filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');}
function toAsciiPreserveCase(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');}
function parseDdMmYyyy(value){const m=String(value||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(!m) return null; return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));}
function formatDdMmYyyy(d){const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear(); return `${dd}/${mm}/${yyyy}`;}
function calcExpireDate(dobText){const dob=parseDdMmYyyy(dobText); if(!dob) return ''; const today=new Date(); let age=today.getFullYear()-dob.getFullYear(); const hadBirthday=(today.getMonth()>dob.getMonth()) || (today.getMonth()===dob.getMonth() && today.getDate()>=dob.getDate()); if(!hadBirthday) age-=1; if(age<12) return formatDdMmYyyy(new Date(dob.getFullYear()+14,dob.getMonth(),dob.getDate())); if(age<23) return formatDdMmYyyy(new Date(dob.getFullYear()+25,dob.getMonth(),dob.getDate())); if(age<38) return formatDdMmYyyy(new Date(dob.getFullYear()+40,dob.getMonth(),dob.getDate())); if(age<58) return formatDdMmYyyy(new Date(dob.getFullYear()+60,dob.getMonth(),dob.getDate())); return '31/12/9999';}
function getIssuePlaceCode(issueDateText){const issueDate=parseDdMmYyyy(issueDateText); const cutoff=new Date(2024,6,1); if(!issueDate) return '318'; return issueDate < cutoff ? '318' : '004';}
function toJsonShape(x){const titleName=toTitleCaseVietnamese(x.full_name||'');const shortName=titleName;const shortNameEnglish=toAsciiPreserveCase(titleName);return {full_name:titleName,full_name_english:toAsciiPreserveCase(titleName),short_name:shortName,short_name_english:shortNameEnglish,date_of_birth:x.date_of_birth||'',gender:x.gender||'',mobile_phone:x.phone_number||'',email:'',idcard_num:x.id_number||'',idcard_issue_date:x.issue_date||'',idcard_expire_date:calcExpireDate(x.date_of_birth||''),nationality:'VN',id_type:'GTTT',issue_place_code:getIssuePlaceCode(x.issue_date||''),occupation:x.occupation||'Kinh doanh tự do',address:x.current_address||''};}
function imageOrPlaceholder(url,label){return url?`<img class="detail-original-image" data-enhance="card" src="${esc(url)}" alt="${esc(label)}">`:`<div class="muted">Chưa có ảnh</div>`;}

function loadImage(url){
  return new Promise((resolve,reject)=>{
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = () => reject(new Error(`Image decode failed: ${url}`));
        img.src = objectUrl;
      })
      .catch(reject);
  });
}

function enhanceCardImage(img, mode='card'){
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  let sx = 0, sy = 0, sWidth = sw, sHeight = sh;
  if (mode === 'card') {
    sWidth = sw;
    sHeight = Math.round(sh * 0.72);
    sx = 0;
    sy = Math.round((sh - sHeight) / 2 + sh * 0.06);
    sy = Math.max(0, sy);
  } else {
    const size = Math.min(sw, sh) * 0.94;
    sWidth = sHeight = Math.round(size);
    sx = Math.round((sw - sWidth) / 2);
    sy = Math.round((sh - sHeight) / 2);
  }
  canvas.width = mode === 'card' ? 1100 : 900;
  canvas.height = mode === 'card' ? 700 : 900;
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const contrast = mode === 'card' ? 1.28 : 1.18;
  const brightness = mode === 'card' ? 10 : 8;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.max(0, Math.min(255, ((d[i] - 128) * contrast) + 128 + brightness));
    d[i+1] = Math.max(0, Math.min(255, ((d[i+1] - 128) * contrast) + 128 + brightness));
    d[i+2] = Math.max(0, Math.min(255, ((d[i+2] - 128) * contrast) + 128 + brightness));
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

async function loadList(){
  const q = encodeURIComponent(els.searchInput.value.trim());
  const fromDate = (els.fromDateInput.value || '').trim();
  const toDate = (els.toDateInput.value || '').trim();
  const query = [`q=${q}`,(fromDate?`from_date=${encodeURIComponent(fromDate)}`:''),(toDate?`to_date=${encodeURIComponent(toDate)}`:'')].filter(Boolean).join('&');
  const res = await fetch(api(`/api/cccd/records${query?`?${query}`:''}`));
  const json = await res.json();
  allItems = json.items || [];
  currentPage = 1;
  renderTable();
}

function renderTable(){
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = allItems.slice(start, start + PAGE_SIZE);
  els.tableBody.innerHTML = pageItems.map((item, idx) => `
    <tr data-id="${esc(item.id)}">
      <td>${start + idx + 1}</td>
      <td>${esc(item.full_name || '')}</td>
      <td>${esc(item.id_number || '')}</td>
      <td>${esc(item.date_of_birth || '')}</td>
      <td>${esc(item.gender || '')}</td>
      <td>${esc(item.phone_number || '')}</td>
      <td>${esc(formatDateTime(item.created_at))}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="muted">Chưa có hồ sơ nào.</td></tr>';
  [...els.tableBody.querySelectorAll('tr[data-id]')].forEach((tr) => {
    tr.onclick = () => {
      const item = allItems.find(x => x.id === tr.dataset.id);
      if (item) showDetail(item);
    };
  });
  els.pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
  els.prevPageBtn.disabled = currentPage <= 1;
  els.nextPageBtn.disabled = currentPage >= totalPages;
}

async function enhanceDetailImages() {
  const imgs = Array.from(document.querySelectorAll('.detail-original-image'));
  for (const imgEl of imgs) {
    try {
      const img = await loadImage(imgEl.src);
      imgEl.src = enhanceCardImage(img, 'card');
    } catch (_) {}
  }
}

function showDetail(item){
  currentItem = item;
  const jsonText = JSON.stringify(toJsonShape(item), null, 2);
  els.detailContent.innerHTML = `
    <div class="detail-grid">
      <div class="detail-box"><label>Họ và tên</label>${esc(item.full_name)}</div>
      <div class="detail-box"><label>Số CCCD</label>${esc(item.id_number)}</div>
      <div class="detail-box"><label>Ngày sinh</label>${esc(item.date_of_birth)}</div>
      <div class="detail-box"><label>Giới tính</label>${esc(item.gender)}</div>
      <div class="detail-box"><label>Số điện thoại</label>${esc(item.phone_number)}</div>
      <div class="detail-box"><label>Ngày thu thập</label>${esc(formatDateTime(item.created_at))}</div>
      <div class="detail-box"><label>Nghề nghiệp</label>${esc(item.occupation)}</div>
      <div class="detail-box"><label>Địa chỉ hiện tại</label>${esc(item.current_address)}</div>
    </div>
    <div class="image-grid">
      <div class="image-card"><span>Mặt trước</span>${imageOrPlaceholder(item.front_image_url, 'Mặt trước')}</div>
      <div class="image-card"><span>Mặt sau</span>${imageOrPlaceholder(item.back_image_url, 'Mặt sau')}</div>
      <div class="image-card"><span>Mã QR</span>${imageOrPlaceholder(item.generated_qr_image_url || item.qr_image_url, 'Mã QR')}</div>
    </div>
    <div class="detail-box json-box"><label>JSON chuẩn</label>${esc(jsonText)}</div>
  `;
  enhanceDetailImages();
}

function exportExcel(){
  const rows = allItems.map((item, idx) => ({
    STT: idx + 1,
    'Họ tên': item.full_name || '',
    'Số CCCD': item.id_number || '',
    'Ngày sinh': item.date_of_birth || '',
    'Giới tính': item.gender || '',
    'Số điện thoại': item.phone_number || '',
    'Ngày thu thập': formatDateTime(item.created_at)
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CCCD Records');
  XLSX.writeFile(wb, 'danh_sach_ho_so_cccd.xlsx');
}

els.searchBtn.addEventListener('click', loadList);
els.exportExcelBtn.addEventListener('click', exportExcel);
els.prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; renderTable(); } });
els.nextPageBtn.addEventListener('click', () => { if (currentPage < Math.ceil(allItems.length / PAGE_SIZE)) { currentPage += 1; renderTable(); } });
els.sendEmailBtn.addEventListener('click', async () => {
  if (!currentItem) return alert('Chọn một hồ sơ trước.');
  try {
    const res = await fetch(api('/api/cccd/send-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_id: currentItem.id, extra_email: els.extraEmailInput.value.trim() })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json?.detail || 'Gửi email thất bại');
    alert(`Đã gửi email tới: ${json.sent_to.join(', ')}`);
  } catch (e) {
    alert(String(e));
  }
});
els.copyJsonBtn.addEventListener('click', async () => {
  if(!currentItem) return;
  const text = JSON.stringify(toJsonShape(currentItem), null, 2);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    alert('Đã copy JSON.');
  } catch (e) {
    alert('Không copy được JSON.');
  }
});
async function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) return resolve(true);
    const done = () => resolve(true);
    img.onload = done;
    img.onerror = done;
  })));
}

els.printBtn.addEventListener('click', async () => {
  if (!currentItem) return;
  try {
    const errors = [];
    const [frontSrc, backSrc, qrSrc] = await Promise.all([
      currentItem.front_image_url ? loadImage(currentItem.front_image_url).then(img => enhanceCardImage(img, 'card')).catch((e)=>{ errors.push(`Mặt trước: ${e.message}`); return currentItem.front_image_url; }) : Promise.resolve(''),
      currentItem.back_image_url ? loadImage(currentItem.back_image_url).then(img => enhanceCardImage(img, 'card')).catch((e)=>{ errors.push(`Mặt sau: ${e.message}`); return currentItem.back_image_url; }) : Promise.resolve(''),
      (currentItem.generated_qr_image_url || currentItem.qr_image_url) ? Promise.resolve(currentItem.generated_qr_image_url || currentItem.qr_image_url) : Promise.resolve('')
    ]);
    if (!frontSrc && !backSrc && !qrSrc) {
      return alert(`Không chuẩn bị được ảnh để in A4. ${errors.join(' | ')}`.trim());
    }
    const root = document.createElement('div');
    root.className = 'print-root';
    root.innerHTML = `
      <div class="print-sheet">
        <div class="print-header">
          <div class="print-meta">
            <h1>Thông tin khách hàng</h1>
            <div><strong>Họ tên:</strong> ${esc(currentItem.full_name)}</div>
            <div><strong>CCCD:</strong> ${esc(currentItem.id_number)}</div>
            <div><strong>Ngày sinh:</strong> ${esc(currentItem.date_of_birth)}</div>
            <div><strong>Giới tính:</strong> ${esc(currentItem.gender)}</div>
            <div><strong>Ngày cấp CCCD:</strong> ${esc(currentItem.issue_date || '')}</div>
            <div><strong>Ngày thu thập:</strong> ${esc(formatDateTime(currentItem.created_at))}</div>
          </div>
          <div class="print-qr-top">${qrSrc ? `<img src="${qrSrc}">` : '<div class="muted">Không có ảnh QR</div>'}</div>
        </div>
        <div class="print-grid">
          <div class="print-card">${frontSrc ? `<img src="${frontSrc}">` : '<div class="muted">Không có ảnh mặt trước</div>'}</div>
          <div class="print-card">${backSrc ? `<img src="${backSrc}">` : '<div class="muted">Không có ảnh mặt sau</div>'}</div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    await waitForImages(root);
    setTimeout(() => {
      window.print();
      setTimeout(() => root.remove(), 800);
    }, 250);
  } catch (e) {
    alert('Không chuẩn bị được dữ liệu in A4.');
  }
});

loadList();
