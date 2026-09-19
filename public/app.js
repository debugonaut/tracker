// Minimalist Retro SIH 2026 Problem Statements Tracker
(function () {
  'use strict';

  let rawData = null;
  let problemStatements = [];
  let bookmarks = new Set(JSON.parse(localStorage.getItem('sih2026_bookmarks') || '[]'));
  let showSavedOnly = false;
  let showActiveOnly = false;
  let snapshotCounts = JSON.parse(localStorage.getItem('sih2026_snapshot_counts') || 'null');
  let currentPage = 1;
  let itemsPerPage = 100;

  const MOON_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  const SUN_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

  // DOM Elements
  const metaStats = document.getElementById('metaStats');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const searchInput = document.getElementById('searchInput');
  const catSelect = document.getElementById('catSelect');
  const themeSelect = document.getElementById('themeSelect');
  const orgSelect = document.getElementById('orgSelect');
  const compSelect = document.getElementById('compSelect');
  const sortSelect = document.getElementById('sortSelect');
  const resetBtn = document.getElementById('resetBtn');

  const resultCount = document.getElementById('resultCount');
  const totalSubmissionsCount = document.getElementById('totalSubmissionsCount');
  const lastUpdatedText = document.getElementById('lastUpdatedText');
  const viewSavedLink = document.getElementById('viewSavedLink');
  const savedCount = document.getElementById('savedCount');

  // Active / Delta Tracking Elements
  const activeStrip = document.getElementById('activeStrip');
  const viewActiveLink = document.getElementById('viewActiveLink');
  const activeCount = document.getElementById('activeCount');
  const markSeenBtn = document.getElementById('markSeenBtn');

  const tableBody = document.getElementById('tableBody');

  // Pagination Elements
  const paginationControls = document.getElementById('paginationControls');
  const pageStart = document.getElementById('pageStart');
  const pageEnd = document.getElementById('pageEnd');
  const pageTotal = document.getElementById('pageTotal');
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');

  // Detail Box Elements
  const detailBox = document.getElementById('detailBox');
  const detailBoxTitle = document.getElementById('detailBoxTitle');
  const closeDetailBox = document.getElementById('closeDetailBox');
  const detailCategory = document.getElementById('detailCategory');
  const detailSubmissions = document.getElementById('detailSubmissions');
  const detailTheme = document.getElementById('detailTheme');
  const detailSlots = document.getElementById('detailSlots');
  const detailOrg = document.getElementById('detailOrg');
  const detailDeadline = document.getElementById('detailDeadline');
  const detailDept = document.getElementById('detailDept');
  const detailText = document.getElementById('detailText');

  function init() {
    initTheme();
    updateSavedCount();
    setupListeners();
    fetchData();
  }

  function initTheme() {
    const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeToggleBtn(curTheme);
  }

  function updateThemeToggleBtn(theme) {
    if (!themeToggleBtn) return;
    if (theme === 'dark') {
      themeToggleBtn.innerHTML = SUN_ICON;
      themeToggleBtn.title = 'Switch to Light Theme';
    } else {
      themeToggleBtn.innerHTML = MOON_ICON;
      themeToggleBtn.title = 'Switch to Dark Theme';
    }
  }

  function toggleTheme() {
    const curTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const nextTheme = curTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('sih2026_theme', nextTheme);
    updateThemeToggleBtn(nextTheme);
    if (window.va) window.va('event', { name: 'Toggle_Theme', data: { theme: nextTheme } });
  }

  function setupListeners() {
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', toggleTheme);
    }

    searchInput.addEventListener('input', () => { currentPage = 1; render(); });
    searchInput.addEventListener('change', (e) => {
      if (window.va && e.target.value.trim()) window.va('event', { name: 'Search', data: { query: e.target.value.trim() } });
    });
    catSelect.addEventListener('change', (e) => {
      currentPage = 1;
      if (window.va) window.va('event', { name: 'Filter_Category', data: { category: e.target.value } });
      render();
    });
    themeSelect.addEventListener('change', (e) => {
      currentPage = 1;
      if (window.va) window.va('event', { name: 'Filter_Theme', data: { theme: e.target.value } });
      render();
    });
    orgSelect.addEventListener('change', (e) => {
      currentPage = 1;
      if (window.va) window.va('event', { name: 'Filter_Org', data: { org: e.target.value } });
      render();
    });
    compSelect.addEventListener('change', (e) => {
      currentPage = 1;
      if (window.va) window.va('event', { name: 'Filter_Comp', data: { comp: e.target.value } });
      render();
    });
    sortSelect.addEventListener('change', (e) => {
      currentPage = 1;
      if (window.va) window.va('event', { name: 'Sort', data: { by: e.target.value } });
      render();
    });

    pageSizeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      itemsPerPage = val === 'all' ? 'all' : parseInt(val, 10);
      currentPage = 1;
      if (window.va) window.va('event', { name: 'Change_Page_Size', data: { size: val } });
      render();
    });

    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    nextPageBtn.addEventListener('click', () => {
      const list = getFilteredList();
      const maxPages = itemsPerPage === 'all' ? 1 : Math.ceil(list.length / itemsPerPage);
      if (currentPage < maxPages) {
        currentPage++;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    resetBtn.addEventListener('click', resetFilters);
    refreshBtn.addEventListener('click', refreshLive);
    exportBtn.addEventListener('click', exportCSV);

    viewSavedLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSavedOnly = !showSavedOnly;
      currentPage = 1;
      if (window.va) window.va('event', { name: 'View_Saved_Toggle', data: { enabled: showSavedOnly } });
      viewSavedLink.textContent = showSavedOnly ? 'Show All Statements' : `Show Saved Only (${bookmarks.size})`;
      viewSavedLink.style.fontWeight = showSavedOnly ? 'bold' : 'normal';
      render();
    });

    if (viewActiveLink) {
      viewActiveLink.addEventListener('click', (e) => {
        e.preventDefault();
        showActiveOnly = !showActiveOnly;
        currentPage = 1;
        if (window.va) window.va('event', { name: 'View_Active_Toggle', data: { enabled: showActiveOnly } });
        viewActiveLink.style.textDecoration = showActiveOnly ? 'none' : 'underline';
        viewActiveLink.style.backgroundColor = showActiveOnly ? '#d4ecd4' : 'transparent';
        render();
      });
    }

    if (markSeenBtn) {
      markSeenBtn.addEventListener('click', (e) => {
        e.preventDefault();
        markAllSeen();
      });
    }

    closeDetailBox.addEventListener('click', () => {
      detailBox.style.display = 'none';
    });
  }

  async function fetchData() {
    try {
      let res = await fetch('/api/data');
      if (!res.ok) {
        res = await fetch('/data/sih2026_data.json');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rawData = await res.json();
      problemStatements = rawData.problem_statements || [];

      // Update Top Nav
      metaStats.textContent = `${rawData.total_problem_statements} Statements | ${rawData.total_submissions.toLocaleString()} Submissions`;
      totalSubmissionsCount.textContent = rawData.total_submissions.toLocaleString();
      lastUpdatedText.textContent = rawData.last_updated_human || 'Today';

      calculateDeltas();
      populateDropdowns(problemStatements);
      render();
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="10" class="text-center" style="color:red; padding:20px;">Error loading data: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function refreshLive() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Refresh failed');
      
      if (data.data) {
        if (window.va) window.va('event', { name: 'Live_Refresh' });
        rawData = data.data;
        problemStatements = rawData.problem_statements || [];
        metaStats.textContent = `${rawData.total_problem_statements} Statements | ${rawData.total_submissions.toLocaleString()} Submissions`;
        totalSubmissionsCount.textContent = rawData.total_submissions.toLocaleString();
        lastUpdatedText.textContent = rawData.last_updated_human || 'Just now';
        
        calculateDeltas();
        populateDropdowns(problemStatements);
        render();

        if (data.status === 'notice') {
          alert(data.message);
        } else {
          alert(`Refreshed! Found ${rawData.total_submissions.toLocaleString()} total live submissions.`);
        }
      }
    } catch (err) {
      if (err.message && (err.message.includes('403') || err.message.includes('Forbidden'))) {
        alert("Live Refresh Notice: The official Government of India portal (sih.gov.in) restricts automated scraping from cloud datacenters (403 Forbidden). When running locally in India (http://localhost:5050), live sync works directly. You can also update the cloud data anytime by running 'python3 scraper.py' locally and pushing.");
      } else {
        alert(`Refresh error: ${err.message}`);
      }
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh Data';
    }
  }

  function calculateDeltas() {
    let totalActive = 0;
    let totalNewIdeas = 0;

    const isFirstVisit = !snapshotCounts;
    const currentCounts = {};

    problemStatements.forEach(p => {
      const current = p.submitted_count || 0;
      currentCounts[p.id] = current;

      if (isFirstVisit) {
        // Fallback to sync-level delta from scraper if present
        p.effective_delta = p.delta_submissions || 0;
      } else {
        const prev = snapshotCounts[p.id] !== undefined ? snapshotCounts[p.id] : current;
        p.effective_delta = Math.max(0, current - prev);
      }

      if (p.effective_delta > 0) {
        totalActive++;
        totalNewIdeas += p.effective_delta;
      }
    });

    if (isFirstVisit) {
      snapshotCounts = currentCounts;
      localStorage.setItem('sih2026_snapshot_counts', JSON.stringify(snapshotCounts));
      localStorage.setItem('sih2026_snapshot_time', new Date().toISOString());
    }

    if (activeStrip) {
      if (totalActive > 0) {
        activeStrip.style.display = 'inline';
        activeCount.textContent = `${totalActive} (+${totalNewIdeas})`;
        viewActiveLink.title = `${totalNewIdeas} new idea submissions across ${totalActive} problem statements`;
      } else {
        activeStrip.style.display = 'none';
      }
    }
  }

  function markAllSeen() {
    snapshotCounts = {};
    problemStatements.forEach(p => {
      snapshotCounts[p.id] = p.submitted_count || 0;
      p.effective_delta = 0;
    });
    localStorage.setItem('sih2026_snapshot_counts', JSON.stringify(snapshotCounts));
    localStorage.setItem('sih2026_snapshot_time', new Date().toISOString());

    if (activeStrip) activeStrip.style.display = 'none';
    showActiveOnly = false;
    if (viewActiveLink) {
      viewActiveLink.style.textDecoration = 'underline';
      viewActiveLink.style.backgroundColor = 'transparent';
    }
    render();
  }

  function populateDropdowns(list) {
    const themes = {};
    const orgs = {};

    list.forEach(p => {
      const t = p.theme || 'Other';
      themes[t] = (themes[t] || 0) + 1;

      const o = p.organization || 'Other';
      orgs[o] = (orgs[o] || 0) + 1;
    });

    // Theme dropdown
    const curTheme = themeSelect.value;
    themeSelect.innerHTML = '<option value="all">All Themes</option>';
    Object.keys(themes).sort().forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = `${t} (${themes[t]})`;
      if (t === curTheme) opt.selected = true;
      themeSelect.appendChild(opt);
    });

    // Org dropdown
    const curOrg = orgSelect.value;
    orgSelect.innerHTML = '<option value="all">All Organizations</option>';
    Object.keys(orgs).sort().forEach(o => {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = `${o} (${orgs[o]})`;
      if (o === curOrg) opt.selected = true;
      orgSelect.appendChild(opt);
    });
  }

  function getFilteredList() {
    const q = searchInput.value.trim().toLowerCase();
    const cat = catSelect.value;
    const theme = themeSelect.value;
    const org = orgSelect.value;
    const comp = compSelect.value;
    const sort = sortSelect.value;

    let list = problemStatements.filter(p => {
      if (showSavedOnly && !bookmarks.has(p.id)) return false;
      if (showActiveOnly && (!p.effective_delta || p.effective_delta <= 0)) return false;
      if (cat !== 'all' && p.category.toLowerCase() !== cat.toLowerCase()) return false;
      if (theme !== 'all' && p.theme !== theme) return false;
      if (org !== 'all' && p.organization !== org) return false;
      if (comp !== 'all' && p.competition !== comp) return false;

      if (q) {
        const snoMatch = p.sno && (String(p.sno) === q || `sno ${p.sno}`.includes(q) || `s.no. ${p.sno}`.includes(q));
        const idMatch = (p.id && p.id.toLowerCase().includes(q)) || (p.ps_number && p.ps_number.toLowerCase().includes(q));
        const titleMatch = p.title && p.title.toLowerCase().includes(q);
        const orgMatch = p.organization && p.organization.toLowerCase().includes(q);
        const themeMatch = p.theme && p.theme.toLowerCase().includes(q);
        const descMatch = p.description && p.description.toLowerCase().includes(q);
        if (!idMatch && !snoMatch && !titleMatch && !orgMatch && !themeMatch && !descMatch) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      switch (sort) {
        case 'active':
          return (b.effective_delta || 0) - (a.effective_delta || 0) || b.submitted_count - a.submitted_count;
        case 'least': return a.submitted_count - b.submitted_count;
        case 'most': return b.submitted_count - a.submitted_count;
        case 'id_asc': return (parseInt(a.sno || a.id, 10) || 0) - (parseInt(b.sno || b.id, 10) || 0);
        case 'id_desc': return (parseInt(b.sno || b.id, 10) || 0) - (parseInt(a.sno || a.id, 10) || 0);
        case 'title': return a.title.localeCompare(b.title);
        default: return 0;
      }
    });

    return list;
  }

  function render() {
    const list = getFilteredList();
    resultCount.textContent = list.length;

    if (list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #666;">No problem statements match the current filters.</td></tr>`;
      paginationControls.style.display = 'none';
      return;
    }

    paginationControls.style.display = 'flex';
    
    let displayList = list;
    let totalPages = 1;
    let startIdx = 0;
    let endIdx = list.length;

    if (itemsPerPage !== 'all') {
      totalPages = Math.ceil(list.length / itemsPerPage);
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;
      
      startIdx = (currentPage - 1) * itemsPerPage;
      endIdx = Math.min(startIdx + itemsPerPage, list.length);
      displayList = list.slice(startIdx, endIdx);
    }

    pageStart.textContent = startIdx + 1;
    pageEnd.textContent = endIdx;
    pageTotal.textContent = list.length;
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    tableBody.innerHTML = displayList.map((p, idx) => {
      const isFav = bookmarks.has(p.id);
      const isSoft = (p.category || '').toLowerCase() === 'software';
      const typePill = isSoft ? '<span class="type-pill type-software">Software</span>' : '<span class="type-pill type-hardware">Hardware</span>';
      
      let subClass = 'sub-low';
      if (p.submitted_count > 150) subClass = 'sub-high';
      else if (p.submitted_count >= 50) subClass = 'sub-med';

      const deltaBadge = p.effective_delta > 0 
        ? `<span class="sub-delta" title="+${p.effective_delta} new idea${p.effective_delta > 1 ? 's' : ''} submitted since last check">+${p.effective_delta}</span>`
        : '';

      const sNo = escapeHtml(p.sno || (startIdx + idx + 1));

      return `
        <tr data-id="${p.id}">
          <td class="text-center s-no-cell">${sNo}</td>
          <td class="text-center">
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${p.id}" title="Bookmark">&#9733;</button>
          </td>
          <td><span class="ps-id-tag">${escapeHtml(p.ps_number || p.id)}</span></td>
          <td>
            <span class="ps-title-link" data-id="${p.id}">${escapeHtml(p.title)}</span>
          </td>
          <td>${typePill}</td>
          <td>${escapeHtml(p.theme)}</td>
          <td>${escapeHtml(p.organization)}</td>
          <td class="text-right">
            <span class="sub-count-text ${subClass}">${p.submitted_count}</span>${deltaBadge} <span style="color:#888;">/ ${p.max_capacity}</span>
          </td>
          <td class="text-right sub-slots">${p.slots_left}</td>
          <td class="text-center">
            <button class="retro-btn btn-sm btn-view" data-id="${p.id}">View</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    tableBody.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBookmark(btn.getAttribute('data-id'));
      });
    });

    tableBody.querySelectorAll('.ps-title-link, .btn-view').forEach(el => {
      el.addEventListener('click', () => {
        showDetail(el.getAttribute('data-id'));
      });
    });
  }

  function showDetail(id) {
    const p = problemStatements.find(item => item.id === id);
    if (!p) return;
    if (window.va) window.va('event', { name: 'View_PS_Detail', data: { ps_id: p.id, theme: p.theme, org: p.organization } });

    detailBoxTitle.innerHTML = `<strong>S.No. ${escapeHtml(p.sno || p.id)} | ${escapeHtml(p.ps_number || p.id)}</strong> - ${escapeHtml(p.title)}`;
    detailCategory.textContent = p.category;

    const deltaBadge = p.effective_delta > 0 
      ? ` <span class="sub-delta" title="+${p.effective_delta} recent submissions">+${p.effective_delta} new</span>`
      : '';

    detailSubmissions.innerHTML = `<strong>${p.submitted_count}</strong>${deltaBadge} / ${p.max_capacity} (${p.fill_percentage}% filled)`;
    detailTheme.textContent = p.theme;
    detailSlots.innerHTML = `<strong style="color:#008800;">${p.slots_left}</strong> slots available`;
    detailOrg.textContent = p.organization;
    detailDeadline.textContent = p.deadline || '30 September 2026';
    detailDept.textContent = p.department || p.organization;

    // Clean format for description
    let desc = escapeHtml(p.description || 'No description provided.');
    desc = desc.replace(/\b(Background:)\b/g, '<strong class="section-tag">$1</strong>');
    desc = desc.replace(/\b(Description:)\b/g, '<strong class="section-tag">$1</strong>');
    desc = desc.replace(/\b(Expected Solution:)\b/g, '<strong class="section-tag">$1</strong>');
    detailText.innerHTML = desc;

    detailBox.style.display = 'block';
    detailBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleBookmark(id) {
    if (bookmarks.has(id)) {
      bookmarks.delete(id);
      if (window.va) window.va('event', { name: 'Bookmark_Remove', data: { ps_id: id } });
    } else {
      bookmarks.add(id);
      if (window.va) window.va('event', { name: 'Bookmark_Add', data: { ps_id: id } });
    }
    localStorage.setItem('sih2026_bookmarks', JSON.stringify([...bookmarks]));
    updateSavedCount();
    render();
  }

  function updateSavedCount() {
    savedCount.textContent = bookmarks.size;
  }

  function resetFilters() {
    searchInput.value = '';
    catSelect.value = 'all';
    themeSelect.value = 'all';
    orgSelect.value = 'all';
    compSelect.value = 'all';
    sortSelect.value = 'most';
    showSavedOnly = false;
    showActiveOnly = false;
    currentPage = 1;
    itemsPerPage = 100;
    pageSizeSelect.value = '100';
    viewSavedLink.textContent = `Show Saved Only (${bookmarks.size})`;
    viewSavedLink.style.fontWeight = 'normal';
    if (viewActiveLink) {
      viewActiveLink.style.textDecoration = 'underline';
      viewActiveLink.style.backgroundColor = 'transparent';
    }
    render();
  }

  function exportCSV() {
    if (window.va) window.va('event', { name: 'Export_CSV' });
    const list = getFilteredList();
    if (!list || list.length === 0) {
      alert("No problem statements to export.");
      return;
    }

    // Only export table columns - clean data without external Google Drive or video links
    const headers = [
      'S.No.',
      'PS ID',
      'Problem Statement Title',
      'Category',
      'Theme',
      'Organization',
      'Department',
      'Submitted Ideas',
      'Max Capacity',
      'Slots Left',
      'Fill %',
      'Competition Level',
      'Deadline'
    ];

    const rows = [headers];

    list.forEach((p, idx) => {
      const clean = (val) => {
        if (val === null || val === undefined) return '';
        return String(val).replace(/[\r\n]+/g, ' ').replace(/"/g, '""').trim();
      };

      rows.push([
        p.sno || (idx + 1),
        clean(p.ps_number || p.id),
        clean(p.title),
        clean(p.category),
        clean(p.theme),
        clean(p.organization),
        clean(p.department || p.organization),
        p.submitted_count !== undefined ? p.submitted_count : 0,
        p.max_capacity !== undefined ? p.max_capacity : 500,
        p.slots_left !== undefined ? p.slots_left : 0,
        `${p.fill_percentage || 0}%`,
        clean(p.competition),
        clean(p.deadline || '30 September 2026')
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sih2026_problem_statements.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Safe startup
  try {
    init();
  } catch (err) {
    console.error('SIH Tracker init failed:', err);
  }

})();
