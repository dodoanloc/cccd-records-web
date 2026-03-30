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
  copyJsonBtn: document.getElementById('copyJsonBtn'),
  printBtn: document.getElementById('printBtn')
};
let allItems = [];
let currentPage = 1;
let currentItem = null;

function api(path){return `${API_BASE}${path}`;}
function esc(v){return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function formatDateTime(v){if(!v) return ''; return String(v).replace('T',' ').slice(0,16);}
function toJsonShape(x){const full=(x.full_name||'').trim();const parts=full?full.split(/\s+/):[];const initials=parts.map(p=>p[0]?.toUpperCase()).filter(Boolean).join('.');return {full_name:(x.full_name||'').toUpperCase(),full_name_english:(x.full_name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(),short_name:initials?`${initials}.`:'' ,short_name_english:initials?`${initials}.`:'' ,date_of_birth:x.date_of_birth||'',gender:x.gender||'',mobile_phone:x.phone_number||'',email:'',idcard_num:x.id_number||'',idcard_issue_date:x.issue_date||'',idcard_expire_date:x.expiry_date||'',nationality:'VN',id_type:'GTTT',issue_place_code:'318'};}
function imageOrPlaceholder(url,label){return url?`<img src="${esc(url)}" alt="${esc(label)}">`:`<div class="muted">Chưa có ảnh</div>`;}

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

function showDetail(item){
  currentItem = item;
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
  `;
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
els.copyJsonBtn.addEventListener('click', async () => { if(!currentItem) return; await navigator.clipboard.writeText(JSON.stringify(toJsonShape(currentItem), null, 2)); });
els.printBtn.addEventListener('click', () => {
  if (!currentItem) return;
  const root = document.createElement('div');
  root.className = 'print-root';
  root.innerHTML = `
    <div class="print-sheet">
      <h1>Hồ sơ khách hàng</h1>
      <div><strong>Họ tên:</strong> ${esc(currentItem.full_name)}</div>
      <div><strong>CCCD:</strong> ${esc(currentItem.id_number)}</div>
      <div><strong>Ngày sinh:</strong> ${esc(currentItem.date_of_birth)}</div>
      <div><strong>Giới tính:</strong> ${esc(currentItem.gender)}</div>
      <div><strong>Số điện thoại:</strong> ${esc(currentItem.phone_number)}</div>
      <div><strong>Ngày thu thập:</strong> ${esc(formatDateTime(currentItem.created_at))}</div>
      <div class="print-grid">
        ${currentItem.front_image_url ? `<img src="${esc(currentItem.front_image_url)}">` : '<div></div>'}
        ${currentItem.back_image_url ? `<img src="${esc(currentItem.back_image_url)}">` : '<div></div>'}
        ${(currentItem.generated_qr_image_url || currentItem.qr_image_url) ? `<img src="${esc(currentItem.generated_qr_image_url || currentItem.qr_image_url)}">` : '<div></div>'}
      </div>
    </div>
  `;
  document.body.appendChild(root);
  window.print();
  setTimeout(() => root.remove(), 300);
});

loadList();
