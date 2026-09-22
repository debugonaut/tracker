// Minimalist Retro SIH 2026 Problem Statements Tracker & Analytics
(function () {
  'use strict';

  let rawData = null;
  let historyData = null;
  let problemStatements = [];
  let bookmarks = new Set(JSON.parse(localStorage.getItem('sih2026_bookmarks') || '[]'));
  let showSavedOnly = false;
  let showActiveOnly = false;
  let snapshotCounts = JSON.parse(localStorage.getItem('sih2026_snapshot_counts') || 'null');
  let currentPage = 1;
  let userSelectedPageSize = false;
  let itemsPerPage = typeof window !== 'undefined' && (window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches)) ? 10 : 50;

  // Day-by-Day Analysis & Multi-PS Filter State
  let selectedDate = 'latest'; // 'latest', 'all_dates', or 'YYYY-MM-DD'
  let selectedPSIds = new Set(); // Empty set = show all statements
  let globalRanks = {}; // pid -> strictly unique rank (1..240)
  let dateRanks = {}; // pid -> strictly unique rank as of selectedDate (1..240)

  function isMobileViewport() {
    return typeof window !== 'undefined' && (window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches));
  }

  const MOON_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  const SUN_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

  // DOM Elements
  const metaStats = document.getElementById('metaStats');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const searchInput = document.getElementById('searchInput');
  const dateSelect = document.getElementById('dateSelect');
  const psMultiContainer = document.getElementById('psMultiContainer');
  const psMultiBtn = document.getElementById('psMultiBtn');
  const psMultiLabel = document.getElementById('psMultiLabel');
  const psMultiPanel = document.getElementById('psMultiPanel');
  const psMultiSearch = document.getElementById('psMultiSearch');
  const psSelectAllBtn = document.getElementById('psSelectAllBtn');
  const psClearBtn = document.getElementById('psClearBtn');
  const psSelectedCountText = document.getElementById('psSelectedCountText');
  const psMultiList = document.getElementById('psMultiList');

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
  const dateFilterChip = document.getElementById('dateFilterChip');
  const psFilterChip = document.getElementById('psFilterChip');

  // Active / Delta Tracking Elements
  const activeStrip = document.getElementById('activeStrip');
  const viewActiveLink = document.getElementById('viewActiveLink');
  const activeCount = document.getElementById('activeCount');
  const markSeenBtn = document.getElementById('markSeenBtn');

  const tableHead = document.getElementById('tableHead');
  const tableHeadRow = document.getElementById('tableHeadRow');
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
  const detailRank = document.getElementById('detailRank');
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
    initPagination();
    updateSavedCount();
    setupListeners();
    fetchData();
  }

  function initPagination() {
    if (!userSelectedPageSize) {
      itemsPerPage = isMobileViewport() ? 10 : 50;
      if (pageSizeSelect) {
        pageSizeSelect.value = String(itemsPerPage);
      }
    }
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

    dateSelect.addEventListener('change', (e) => {
      selectedDate = e.target.value;
      currentPage = 1;
      updateDateRanks();
      if (window.va) window.va('event', { name: 'Filter_Date', data: { date: selectedDate } });
      render();
    });

    // Multi-PS Dropdown Toggle
    psMultiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = psMultiPanel.style.display === 'block';
      psMultiPanel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && psMultiSearch) {
        psMultiSearch.value = '';
        filterPsMultiChecklist('');
        psMultiSearch.focus();
      }
    });

    // Close Multi-PS panel when clicking outside
    document.addEventListener('click', (e) => {
      if (psMultiContainer && !psMultiContainer.contains(e.target)) {
        psMultiPanel.style.display = 'none';
      }
    });

    // Search inside Multi-PS checklist
    psMultiSearch.addEventListener('input', (e) => {
      filterPsMultiChecklist(e.target.value.trim().toLowerCase());
    });

    // Multi-PS Select All
    psSelectAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      problemStatements.forEach(p => selectedPSIds.add(p.id));
      syncPsCheckboxes();
      updatePsMultiLabel();
      currentPage = 1;
      render();
    });

    // Multi-PS Clear
    psClearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearPsSelection();
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
      userSelectedPageSize = true;
      const val = e.target.value;
      itemsPerPage = val === 'all' ? 'all' : parseInt(val, 10);
      currentPage = 1;
      if (window.va) window.va('event', { name: 'Change_Page_Size', data: { size: val } });
      render();
    });

    window.addEventListener('resize', () => {
      if (!userSelectedPageSize) {
        const expected = isMobileViewport() ? 10 : 50;
        if (itemsPerPage !== expected) {
          itemsPerPage = expected;
          if (pageSizeSelect) pageSizeSelect.value = String(itemsPerPage);
          currentPage = 1;
          render();
        }
      }
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
      document.body.style.overflow = '';
    });

    detailBox.addEventListener('click', (e) => {
      if (e.target === detailBox) {
        detailBox.style.display = 'none';
        document.body.style.overflow = '';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && detailBox.style.display !== 'none') {
        detailBox.style.display = 'none';
        document.body.style.overflow = '';
      }
    });
  }

  function filterPsMultiChecklist(q) {
    if (!psMultiList) return;
    const items = psMultiList.querySelectorAll('.multiselect-item');
    items.forEach(item => {
      const id = (item.getAttribute('data-id') || '').toLowerCase();
      const title = (item.getAttribute('data-title') || '').toLowerCase();
      if (!q || id.includes(q) || title.includes(q)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  function syncPsCheckboxes() {
    if (!psMultiList) return;
    const checkboxes = psMultiList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = selectedPSIds.has(cb.value);
    });
  }

  function clearPsSelection() {
    selectedPSIds.clear();
    syncPsCheckboxes();
    updatePsMultiLabel();
    currentPage = 1;
    render();
  }

  async function fetchData() {
    try {
      const [resData, resHist] = await Promise.allSettled([
        fetch('/api/data').then(r => r.ok ? r.json() : fetch('/data/sih2026_data.json').then(r2 => r2.json())),
        fetch('/api/history').then(r => r.ok ? r.json() : fetch('/data/history.json').then(r2 => r2.json()))
      ]);

      if (resData.status === 'fulfilled' && resData.value) {
        rawData = resData.value;
        problemStatements = rawData.problem_statements || [];
      } else {
        throw new Error('Failed to load problem statements data');
      }

      if (resHist.status === 'fulfilled' && resHist.value) {
        historyData = resHist.value;
      }

      // Update Top Nav
      metaStats.textContent = `${rawData.total_problem_statements} Statements | ${rawData.total_submissions.toLocaleString()} Submissions`;
      totalSubmissionsCount.textContent = rawData.total_submissions.toLocaleString();
      lastUpdatedText.textContent = rawData.last_updated_human || 'Today';

      calculateDeltas();
      computeGlobalRanks();
      populateDateOptions();
      populateDropdowns(problemStatements);
      populatePsMultiChecklist(problemStatements);
      render();
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="11" class="text-center" style="color:red; padding:20px;">Error loading data: ${escapeHtml(err.message)}</td></tr>`;
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
        
        // Refetch history
        try {
          const histRes = await fetch('/api/history');
          if (histRes.ok) historyData = await histRes.json();
        } catch (_) {}

        calculateDeltas();
        computeGlobalRanks();
        populateDateOptions();
        populateDropdowns(problemStatements);
        populatePsMultiChecklist(problemStatements);
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

  // --- Strictly Unique Sequential Ranks (Duplicates ranked one below another) ---
  function computeGlobalRanks() {
    globalRanks = computeRankMap(problemStatements, 'latest');
    updateDateRanks();
  }

  function updateDateRanks() {
    if (selectedDate && selectedDate !== 'latest' && selectedDate !== 'all_dates') {
      dateRanks = computeRankMap(problemStatements, selectedDate);
    } else {
      dateRanks = globalRanks;
    }
  }

  function computeRankMap(statements, dateKey) {
    // Sort strictly: primary by submission count descending, secondary by S.No ascending
    // Ensures duplicate counts are ranked deterministically one below the other
    const sorted = [...statements].sort((a, b) => {
      const cA = getCountForDate(a, dateKey);
      const cB = getCountForDate(b, dateKey);
      if (cB !== cA) return cB - cA;
      const snoA = parseInt(a.sno || a.id, 10) || 0;
      const snoB = parseInt(b.sno || b.id, 10) || 0;
      return snoA - snoB;
    });

    const rankMap = {};
    for (let i = 0; i < sorted.length; i++) {
      // Strictly sequential: 1, 2, 3, ... 240 without duplicate numbers
      rankMap[sorted[i].id] = i + 1;
    }
    return rankMap;
  }

  function getCountForDate(p, dateKey) {
    if (!dateKey || dateKey === 'latest' || dateKey === 'all_dates') {
      return p.submitted_count || 0;
    }
    if (historyData && historyData.history && historyData.history[p.id]) {
      const val = historyData.history[p.id][dateKey];
      if (val !== undefined) return val;
    }
    return p.submitted_count || 0;
  }

  function getDeltaForDate(p, dateKey) {
    if (!dateKey || dateKey === 'latest') {
      return p.effective_delta || 0;
    }
    if (!historyData || !historyData.dates) return 0;
    const curVal = getCountForDate(p, dateKey);
    const dateIdx = historyData.dates.indexOf(dateKey);
    if (dateIdx > 0) {
      const prevDate = historyData.dates[dateIdx - 1];
      const prevVal = getCountForDate(p, prevDate);
      return Math.max(0, curVal - prevVal);
    }
    return 0;
  }

  function formatDateHuman(dStr) {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return `${day} ${monthNames[mIdx] || ''} ${year}`;
      }
    } catch (_) {}
    return dStr;
  }

  function formatShortDate(dStr) {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return `${day} ${monthNames[mIdx] || ''}`;
      }
    } catch (_) {}
    return dStr;
  }

  // --- Populate Dropdowns & Controls ---
  function populateDateOptions() {
    if (!dateSelect) return;
    const curVal = dateSelect.value || 'latest';
    const dates = (historyData && historyData.dates) ? [...historyData.dates].sort().reverse() : [];
    
    let html = '<option value="latest">Latest (Live)</option>';
    dates.forEach(d => {
      const isToday = d === '2026-09-23';
      const human = isToday ? '23 Sep 2026 (Today)' : formatDateHuman(d);
      const total = historyData.daily_totals && historyData.daily_totals[d] !== undefined ? `${historyData.daily_totals[d].toLocaleString()} ideas` : '';
      html += `<option value="${d}">${human} ${total ? '(' + total + ')' : ''}</option>`;
    });
    html += '<option value="all_dates">All Dates (Day-by-Day)</option>';
    dateSelect.innerHTML = html;

    if ([...dateSelect.options].some(o => o.value === curVal)) {
      dateSelect.value = curVal;
      selectedDate = curVal;
    } else {
      dateSelect.value = 'latest';
      selectedDate = 'latest';
    }
  }

  function populatePsMultiChecklist(list) {
    if (!psMultiList) return;
    // Checkboxes are initially unchecked (meaning showing all 240)
    psMultiList.innerHTML = list.map(p => {
      const isChecked = selectedPSIds.has(p.id);
      return `
        <label class="multiselect-item" data-id="${escapeHtml(p.id)}" data-title="${escapeHtml(p.title)}">
          <input type="checkbox" value="${escapeHtml(p.id)}" ${isChecked ? 'checked' : ''}>
          <span class="multiselect-item-id">${escapeHtml(p.ps_number || p.id)}</span>
          <span class="multiselect-item-title" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</span>
          <span class="multiselect-item-count">${p.submitted_count}</span>
        </label>
      `;
    }).join('');

    psMultiList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          selectedPSIds.add(cb.value);
        } else {
          selectedPSIds.delete(cb.value);
        }
        updatePsMultiLabel();
        currentPage = 1;
        render();
      });
    });

    updatePsMultiLabel();
  }

  function updatePsMultiLabel() {
    const total = problemStatements.length || 240;
    if (selectedPSIds.size === 0) {
      psMultiLabel.textContent = `Select PS (All ${total})`;
      psSelectedCountText.textContent = `Showing all (check to filter)`;
      psFilterChip.style.display = 'none';
      psFilterChip.innerHTML = '';
    } else if (selectedPSIds.size === total) {
      psMultiLabel.textContent = `All ${total} Selected`;
      psSelectedCountText.textContent = `All ${total} selected`;
      psFilterChip.style.display = 'none';
      psFilterChip.innerHTML = '';
    } else if (selectedPSIds.size === 1) {
      const pid = [...selectedPSIds][0];
      const p = problemStatements.find(item => item.id === pid);
      const name = p ? (p.ps_number || p.id) : pid;
      psMultiLabel.textContent = `PS ${name}`;
      psSelectedCountText.textContent = `1 PS filtered`;
      psFilterChip.style.display = 'inline';
      psFilterChip.innerHTML = `Filtered: <strong>PS ${escapeHtml(name)}</strong> <a href="#" id="chipClearPs" style="color:#cc0000; text-decoration:none; margin-left:4px; font-weight:bold;">[✕ Clear]</a>`;
      attachChipClearListener();
    } else {
      psMultiLabel.textContent = `${selectedPSIds.size} PS Selected`;
      psSelectedCountText.textContent = `${selectedPSIds.size} of ${total} filtered`;
      psFilterChip.style.display = 'inline';
      psFilterChip.innerHTML = `Filtered: <strong>${selectedPSIds.size} Statements</strong> <a href="#" id="chipClearPs" style="color:#cc0000; text-decoration:none; margin-left:4px; font-weight:bold;">[✕ Clear]</a>`;
      attachChipClearListener();
    }
  }

  function attachChipClearListener() {
    const chipClear = document.getElementById('chipClearPs');
    if (chipClear) {
      chipClear.addEventListener('click', (e) => {
        e.preventDefault();
        clearPsSelection();
      });
    }
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

  // --- Filtering & Sorting ---
  function getFilteredList() {
    const q = searchInput.value.trim().toLowerCase();
    const cat = catSelect.value;
    const theme = themeSelect.value;
    const org = orgSelect.value;
    const comp = compSelect.value;
    const sort = sortSelect.value;

    let list = problemStatements.filter(p => {
      // PS Multi-select filter: if set is not empty, strictly match selected statements
      if (selectedPSIds.size > 0 && selectedPSIds.size < problemStatements.length) {
        if (!selectedPSIds.has(p.id)) return false;
      }

      if (showSavedOnly && !bookmarks.has(p.id)) return false;
      if (showActiveOnly && (!p.effective_delta || p.effective_delta <= 0)) return false;
      if (cat !== 'all' && p.category.toLowerCase() !== cat.toLowerCase()) return false;
      if (theme !== 'all' && p.theme !== theme) return false;
      if (org !== 'all' && p.organization !== org) return false;

      // When date is chosen, competition uses count as of that date
      const subCount = getCountForDate(p, selectedDate);
      if (comp !== 'all') {
        let level = 'Low';
        if (subCount > 300) level = 'Crowded';
        else if (subCount > 150) level = 'High';
        else if (subCount >= 50) level = 'Medium';
        if (level !== comp) return false;
      }

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
      const cA = getCountForDate(a, selectedDate);
      const cB = getCountForDate(b, selectedDate);
      const snoA = parseInt(a.sno || a.id, 10) || 0;
      const snoB = parseInt(b.sno || b.id, 10) || 0;

      switch (sort) {
        case 'active':
          return (getDeltaForDate(b, selectedDate) - getDeltaForDate(a, selectedDate)) || (cB - cA) || (snoA - snoB);
        case 'least':
          if (cA !== cB) return cA - cB;
          return snoA - snoB;
        case 'most':
          if (cB !== cA) return cB - cA;
          return snoA - snoB;
        case 'id_asc': return snoA - snoB;
        case 'id_desc': return snoB - snoA;
        case 'title': return a.title.localeCompare(b.title);
        default: return 0;
      }
    });

    return list;
  }

  // --- Render Table & UI ---
  function render() {
    const list = getFilteredList();
    resultCount.textContent = list.length;

    // Update Status Strip indicators for historical date
    if (selectedDate && selectedDate !== 'latest') {
      dateFilterChip.style.display = 'inline';
      if (selectedDate === 'all_dates') {
        dateFilterChip.textContent = 'Mode: All Dates (Day-by-Day)';
      } else {
        dateFilterChip.textContent = `Date: ${formatDateHuman(selectedDate)}`;
      }
    } else {
      dateFilterChip.style.display = 'none';
    }

    // Render Table Header depending on mode
    renderTableHeader();

    const datesCount = (historyData && historyData.dates) ? historyData.dates.length : 1;
    const colSpan = selectedDate === 'all_dates' ? (datesCount > 1 ? 7 + datesCount : 9) : 11;

    if (list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center" style="padding: 24px; color: #666;">No problem statements match the current filters.</td></tr>`;
      paginationControls.style.display = 'none';
      return;
    }

    paginationControls.style.display = 'flex';
    
    let displayList = list;
    let totalPages = 1;
    let startIdx = 0;
    let endIdx = list.length;

    if (!userSelectedPageSize && pageSizeSelect && pageSizeSelect.value !== String(itemsPerPage)) {
      pageSizeSelect.value = String(itemsPerPage);
    }

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

    if (selectedDate === 'all_dates') {
      renderAllDatesRows(displayList, startIdx);
    } else {
      renderStandardRows(displayList, startIdx);
    }

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

  function renderTableHeader() {
    if (!tableHeadRow) return;
    if (selectedDate === 'all_dates') {
      const dates = (historyData && historyData.dates) ? historyData.dates : ['2026-09-23'];
      if (dates.length > 1) {
        let dateColsHtml = dates.map(d => `<th width="75" class="text-right day-header">${formatShortDate(d)}</th>`).join('');
        tableHeadRow.innerHTML = `
          <th width="44" class="text-center">S.No.</th>
          <th width="54" class="text-center" id="thRank" title="Nationwide Leaderboard Rank">Rank</th>
          <th width="32" class="text-center">Fav</th>
          <th width="85">PS ID</th>
          <th>Problem Statement Title</th>
          ${dateColsHtml}
          <th width="85" class="text-right" title="Net Growth Across Recorded Dates">Net Growth</th>
          <th width="65" class="text-center">Action</th>
        `;
      } else {
        tableHeadRow.innerHTML = `
          <th width="44" class="text-center">S.No.</th>
          <th width="54" class="text-center" id="thRank" title="Nationwide Leaderboard Rank">Rank</th>
          <th width="32" class="text-center">Fav</th>
          <th width="85">PS ID</th>
          <th>Problem Statement Title</th>
          <th width="85">Type</th>
          <th width="115" class="text-right">${formatShortDate(dates[0])} (Today)</th>
          <th width="80" class="text-right">Slots Left</th>
          <th width="65" class="text-center">Action</th>
        `;
      }
    } else {
      const subTitle = (selectedDate && selectedDate !== 'latest')
        ? `Submissions (${formatShortDate(selectedDate)})`
        : 'Submissions';

      tableHeadRow.innerHTML = `
        <th width="44" class="text-center">S.No.</th>
        <th width="54" class="text-center" id="thRank" title="Nationwide Leaderboard Rank">Rank</th>
        <th width="32" class="text-center">Fav</th>
        <th width="85">PS ID</th>
        <th>Problem Statement Title</th>
        <th width="85">Type</th>
        <th width="150">Theme</th>
        <th width="170">Organization</th>
        <th width="115" class="text-right" id="thSubmissions">${subTitle}</th>
        <th width="80" class="text-right" id="thSlots">Slots Left</th>
        <th width="65" class="text-center">Action</th>
      `;
    }
  }

  function renderStandardRows(displayList, startIdx) {
    const isSingleDate = selectedDate && selectedDate !== 'latest';

    tableBody.innerHTML = displayList.map((p, idx) => {
      const isFav = bookmarks.has(p.id);
      const isSoft = (p.category || '').toLowerCase() === 'software';
      const typePill = isSoft ? '<span class="type-pill type-software">Software</span>' : '<span class="type-pill type-hardware">Hardware</span>';
      
      const subCount = getCountForDate(p, selectedDate);
      const slotsLeft = Math.max(0, (p.max_capacity || 500) - subCount);

      let subClass = 'sub-low';
      if (subCount > 150) subClass = 'sub-high';
      else if (subCount >= 50) subClass = 'sub-med';

      const delta = getDeltaForDate(p, selectedDate);
      const deltaBadge = delta > 0 
        ? `<span class="sub-delta" title="+${delta} ideas submitted">+${delta}</span>`
        : '';

      const sNo = escapeHtml(p.sno || (startIdx + idx + 1));
      
      // Strictly unique sequential rank: #1, #2, #3... (no duplicates, no medals, no emojis)
      const rankNum = isSingleDate ? (dateRanks[p.id] || (startIdx + idx + 1)) : (globalRanks[p.id] || (startIdx + idx + 1));
      const rankClass = rankNum <= 3 ? 'rank-top' : '';

      return `
        <tr data-id="${p.id}" class="ps-row">
          <td class="text-center s-no-cell cell-sno" data-label="S.No.">${sNo}</td>
          <td class="text-center cell-rank" data-label="Rank">
            <span class="rank-badge ${rankClass}">#${rankNum}</span>
          </td>
          <td class="text-center cell-fav">
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${p.id}" title="Bookmark" aria-label="Bookmark problem statement">&#9733;</button>
          </td>
          <td class="cell-id" data-label="PS ID"><span class="ps-id-tag">${escapeHtml(p.ps_number || p.id)}</span></td>
          <td class="cell-title">
            <span class="ps-title-link" data-id="${p.id}">${escapeHtml(p.title)}</span>
          </td>
          <td class="cell-type" data-label="Category">${typePill}</td>
          <td class="cell-theme" data-label="Theme">${escapeHtml(p.theme)}</td>
          <td class="cell-org" data-label="Organization">${escapeHtml(p.organization)}</td>
          <td class="text-right cell-submissions" data-label="Submissions">
            <span class="sub-count-text ${subClass}">${subCount}</span>${deltaBadge} <span class="sub-capacity-text" style="color:#888;">/ ${p.max_capacity}</span>
          </td>
          <td class="text-right sub-slots cell-slots" data-label="Slots Left">${slotsLeft}</td>
          <td class="text-center cell-action">
            <button class="retro-btn btn-sm btn-view" data-id="${p.id}">View</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderAllDatesRows(displayList, startIdx) {
    const dates = (historyData && historyData.dates) ? historyData.dates : ['2026-09-23'];

    tableBody.innerHTML = displayList.map((p, idx) => {
      const isFav = bookmarks.has(p.id);
      const sNo = escapeHtml(p.sno || (startIdx + idx + 1));
      const rankNum = globalRanks[p.id] || (startIdx + idx + 1);
      const rankClass = rankNum <= 3 ? 'rank-top' : '';

      if (dates.length > 1) {
        let firstVal = null;
        let lastVal = p.submitted_count || 0;

        const dateCells = dates.map(d => {
          const val = (historyData && historyData.history && historyData.history[p.id] && historyData.history[p.id][d] !== undefined)
            ? historyData.history[p.id][d]
            : (p.submitted_count || 0);
          if (firstVal === null) firstVal = val;
          lastVal = val;
          return `<td class="text-right cell-day" data-label="${formatShortDate(d)}">${val}</td>`;
        }).join('');

        const netGrowth = Math.max(0, (lastVal - (firstVal || 0)));
        const growthBadge = netGrowth > 0 ? `+${netGrowth}` : '0';

        return `
          <tr data-id="${p.id}" class="ps-row">
            <td class="text-center s-no-cell cell-sno" data-label="S.No.">${sNo}</td>
            <td class="text-center cell-rank" data-label="Rank">
              <span class="rank-badge ${rankClass}">#${rankNum}</span>
            </td>
            <td class="text-center cell-fav">
              <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${p.id}" title="Bookmark" aria-label="Bookmark problem statement">&#9733;</button>
            </td>
            <td class="cell-id" data-label="PS ID"><span class="ps-id-tag">${escapeHtml(p.ps_number || p.id)}</span></td>
            <td class="cell-title">
              <span class="ps-title-link" data-id="${p.id}">${escapeHtml(p.title)}</span>
            </td>
            ${dateCells}
            <td class="text-right cell-growth" data-label="Net Growth">${growthBadge}</td>
            <td class="text-center cell-action">
              <button class="retro-btn btn-sm btn-view" data-id="${p.id}">View</button>
            </td>
          </tr>
        `;
      } else {
        const isSoft = (p.category || '').toLowerCase() === 'software';
        const typePill = isSoft ? '<span class="type-pill type-software">Software</span>' : '<span class="type-pill type-hardware">Hardware</span>';
        const subCount = p.submitted_count || 0;
        const slotsLeft = Math.max(0, (p.max_capacity || 500) - subCount);

        let subClass = 'sub-low';
        if (subCount > 150) subClass = 'sub-high';
        else if (subCount >= 50) subClass = 'sub-med';

        return `
          <tr data-id="${p.id}" class="ps-row">
            <td class="text-center s-no-cell cell-sno" data-label="S.No.">${sNo}</td>
            <td class="text-center cell-rank" data-label="Rank">
              <span class="rank-badge ${rankClass}">#${rankNum}</span>
            </td>
            <td class="text-center cell-fav">
              <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${p.id}" title="Bookmark" aria-label="Bookmark problem statement">&#9733;</button>
            </td>
            <td class="cell-id" data-label="PS ID"><span class="ps-id-tag">${escapeHtml(p.ps_number || p.id)}</span></td>
            <td class="cell-title">
              <span class="ps-title-link" data-id="${p.id}">${escapeHtml(p.title)}</span>
            </td>
            <td class="cell-type" data-label="Category">${typePill}</td>
            <td class="text-right cell-submissions" data-label="Submissions">
              <span class="sub-count-text ${subClass}">${subCount}</span> <span class="sub-capacity-text" style="color:#888;">/ ${p.max_capacity}</span>
            </td>
            <td class="text-right sub-slots cell-slots" data-label="Slots Left">${slotsLeft}</td>
            <td class="text-center cell-action">
              <button class="retro-btn btn-sm btn-view" data-id="${p.id}">View</button>
            </td>
          </tr>
        `;
      }
    }).join('');
  }

  function showDetail(id) {
    const p = problemStatements.find(item => item.id === id);
    if (!p) return;
    if (window.va) window.va('event', { name: 'View_PS_Detail', data: { ps_id: p.id, theme: p.theme, org: p.organization } });

    detailBoxTitle.innerHTML = `<strong>S.No. ${escapeHtml(p.sno || p.id)} | ${escapeHtml(p.ps_number || p.id)}</strong> - ${escapeHtml(p.title)}`;
    detailCategory.textContent = p.category;

    const rankNum = globalRanks[p.id] || '--';
    const rankClass = typeof rankNum === 'number' && rankNum <= 3 ? 'rank-top' : '';
    detailRank.innerHTML = `<span class="rank-badge ${rankClass}">#${rankNum}</span> <span style="font-size:11px; color:var(--text-muted);">(Nationwide)</span>`;

    const subCount = getCountForDate(p, selectedDate);
    const slotsLeft = Math.max(0, (p.max_capacity || 500) - subCount);
    const fillPct = Math.round((subCount / (p.max_capacity || 500)) * 100);

    const delta = getDeltaForDate(p, selectedDate);
    const deltaBadge = delta > 0 
      ? ` <span class="sub-delta" title="+${delta} submissions">+${delta} new</span>`
      : '';

    detailSubmissions.innerHTML = `<strong>${subCount}</strong>${deltaBadge} / ${p.max_capacity} (${fillPct}% filled)`;
    detailTheme.textContent = p.theme;
    detailSlots.innerHTML = `<strong style="color:#008800;">${slotsLeft}</strong> slots available`;
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
    if (window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
      const detailBody = detailBox.querySelector('.detail-box-body');
      if (detailBody) detailBody.scrollTop = 0;
    } else {
      detailBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    dateSelect.value = 'latest';
    selectedDate = 'latest';
    clearPsSelection();

    catSelect.value = 'all';
    themeSelect.value = 'all';
    orgSelect.value = 'all';
    compSelect.value = 'all';
    sortSelect.value = 'most';
    showSavedOnly = false;
    showActiveOnly = false;
    userSelectedPageSize = false;
    currentPage = 1;
    itemsPerPage = isMobileViewport() ? 10 : 50;
    if (pageSizeSelect) pageSizeSelect.value = String(itemsPerPage);
    viewSavedLink.textContent = `Show Saved Only (${bookmarks.size})`;
    viewSavedLink.style.fontWeight = 'normal';
    if (viewActiveLink) {
      viewActiveLink.style.textDecoration = 'underline';
      viewActiveLink.style.backgroundColor = 'transparent';
    }
    updateDateRanks();
    render();
  }

  function exportCSV() {
    if (window.va) window.va('event', { name: 'Export_CSV' });
    const list = getFilteredList();
    if (!list || list.length === 0) {
      alert("No problem statements to export.");
      return;
    }

    const clean = (val) => {
      if (val === null || val === undefined) return '';
      return String(val).replace(/[\r\n]+/g, ' ').replace(/"/g, '""').trim();
    };

    let headers = [];
    let rows = [];

    if (selectedDate === 'all_dates') {
      const dates = (historyData && historyData.dates) ? historyData.dates : ['2026-09-23'];
      headers = [
        'S.No.',
        'Rank',
        'PS ID',
        'Problem Statement Title',
        'Category',
        'Theme',
        'Organization',
        ...dates.map(d => `Submissions (${formatShortDate(d)})`),
        'Net Growth',
        'Max Capacity',
        'Deadline'
      ];
      rows = [headers];

      list.forEach((p, idx) => {
        let firstVal = null;
        let lastVal = p.submitted_count || 0;
        const dateVals = dates.map(d => {
          const val = (historyData && historyData.history && historyData.history[p.id] && historyData.history[p.id][d] !== undefined)
            ? historyData.history[p.id][d]
            : (p.submitted_count || 0);
          if (firstVal === null) firstVal = val;
          lastVal = val;
          return val;
        });
        const netGrowth = Math.max(0, lastVal - (firstVal || 0));
        const rank = globalRanks[p.id] || (idx + 1);

        rows.push([
          p.sno || (idx + 1),
          `#${rank}`,
          clean(p.ps_number || p.id),
          clean(p.title),
          clean(p.category),
          clean(p.theme),
          clean(p.organization),
          ...dateVals,
          netGrowth,
          p.max_capacity !== undefined ? p.max_capacity : 500,
          clean(p.deadline || '30 September 2026')
        ]);
      });
    } else {
      const subHeader = (selectedDate && selectedDate !== 'latest')
        ? `Submissions (${formatShortDate(selectedDate)})`
        : 'Submitted Ideas';

      headers = [
        'S.No.',
        'Rank',
        'PS ID',
        'Problem Statement Title',
        'Category',
        'Theme',
        'Organization',
        'Department',
        subHeader,
        'Max Capacity',
        'Slots Left',
        'Fill %',
        'Competition Level',
        'Deadline'
      ];
      rows = [headers];

      list.forEach((p, idx) => {
        const subCount = getCountForDate(p, selectedDate);
        const slotsLeft = Math.max(0, (p.max_capacity || 500) - subCount);
        const fillPct = Math.round((subCount / (p.max_capacity || 500)) * 100);
        const rank = (selectedDate && selectedDate !== 'latest') ? (dateRanks[p.id] || idx + 1) : (globalRanks[p.id] || idx + 1);

        rows.push([
          p.sno || (idx + 1),
          `#${rank}`,
          clean(p.ps_number || p.id),
          clean(p.title),
          clean(p.category),
          clean(p.theme),
          clean(p.organization),
          clean(p.department || p.organization),
          subCount,
          p.max_capacity !== undefined ? p.max_capacity : 500,
          slotsLeft,
          `${fillPct}%`,
          clean(p.competition),
          clean(p.deadline || '30 September 2026')
        ]);
      });
    }

    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = selectedDate === 'all_dates' ? 'sih2026_day_by_day_analysis.csv' : (selectedDate !== 'latest' ? `sih2026_submissions_${selectedDate}.csv` : 'sih2026_problem_statements.csv');
    link.setAttribute('download', fileName);
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
