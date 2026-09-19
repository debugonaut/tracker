// Minimalist Retro SIH 2026 Problem Statements Tracker
(function () {
  'use strict';

  let rawData = null;
  let problemStatements = [];
  let bookmarks = new Set(JSON.parse(localStorage.getItem('sih2026_bookmarks') || '[]'));
  let showSavedOnly = false;

  // DOM Elements
  const metaStats = document.getElementById('metaStats');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');

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

  const tableBody = document.getElementById('tableBody');

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

  init();

  function init() {
    updateSavedCount();
    setupListeners();
    fetchData();
  }

  function setupListeners() {
    searchInput.addEventListener('input', render);
    catSelect.addEventListener('change', render);
    themeSelect.addEventListener('change', render);
    orgSelect.addEventListener('change', render);
    compSelect.addEventListener('change', render);
    sortSelect.addEventListener('change', render);

    resetBtn.addEventListener('click', resetFilters);
    refreshBtn.addEventListener('click', refreshLive);
    exportBtn.addEventListener('click', () => {
      window.location.href = '/api/export';
    });

    viewSavedLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSavedOnly = !showSavedOnly;
      viewSavedLink.textContent = showSavedOnly ? 'Show All Statements' : `Show Saved Only (${bookmarks.size})`;
      viewSavedLink.style.fontWeight = showSavedOnly ? 'bold' : 'normal';
      render();
    });

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

      populateDropdowns(problemStatements);
      render();
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="color:red; padding:20px;">Error loading data: ${escapeHtml(err.message)}</td></tr>`;
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
        rawData = data.data;
        problemStatements = rawData.problem_statements || [];
        metaStats.textContent = `${rawData.total_problem_statements} Statements | ${rawData.total_submissions.toLocaleString()} Submissions`;
        totalSubmissionsCount.textContent = rawData.total_submissions.toLocaleString();
        lastUpdatedText.textContent = rawData.last_updated_human || 'Just now';
        populateDropdowns(problemStatements);
        render();
        alert(`Refreshed! Found ${rawData.total_submissions.toLocaleString()} total live submissions.`);
      }
    } catch (err) {
      alert(`Refresh error: ${err.message}`);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh Data';
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

  function getFilteredList() {
    const q = searchInput.value.trim().toLowerCase();
    const cat = catSelect.value;
    const theme = themeSelect.value;
    const org = orgSelect.value;
    const comp = compSelect.value;
    const sort = sortSelect.value;

    let list = problemStatements.filter(p => {
      if (showSavedOnly && !bookmarks.has(p.id)) return false;
      if (cat !== 'all' && p.category.toLowerCase() !== cat.toLowerCase()) return false;
      if (theme !== 'all' && p.theme !== theme) return false;
      if (org !== 'all' && p.organization !== org) return false;
      if (comp !== 'all' && p.competition !== comp) return false;

      if (q) {
        const idMatch = (p.id && p.id.toLowerCase().includes(q)) || (p.ps_number && p.ps_number.toLowerCase().includes(q));
        const titleMatch = p.title && p.title.toLowerCase().includes(q);
        const orgMatch = p.organization && p.organization.toLowerCase().includes(q);
        const themeMatch = p.theme && p.theme.toLowerCase().includes(q);
        const descMatch = p.description && p.description.toLowerCase().includes(q);
        if (!idMatch && !titleMatch && !orgMatch && !themeMatch && !descMatch) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      switch (sort) {
        case 'least': return a.submitted_count - b.submitted_count;
        case 'most': return b.submitted_count - a.submitted_count;
        case 'id_asc': return (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
        case 'id_desc': return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
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
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: #666;">No problem statements match the current filters.</td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map(p => {
      const isFav = bookmarks.has(p.id);
      const isSoft = (p.category || '').toLowerCase() === 'software';
      const typePill = isSoft ? '<span class="type-pill type-software">Software</span>' : '<span class="type-pill type-hardware">Hardware</span>';
      
      let subClass = 'sub-low';
      if (p.submitted_count > 150) subClass = 'sub-high';
      else if (p.submitted_count >= 50) subClass = 'sub-med';

      return `
        <tr data-id="${p.id}">
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
            <span class="sub-count-text ${subClass}">${p.submitted_count}</span> <span style="color:#888;">/ ${p.max_capacity}</span>
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

    detailBoxTitle.innerHTML = `<strong>${escapeHtml(p.ps_number || p.id)}</strong> - ${escapeHtml(p.title)}`;
    detailCategory.textContent = p.category;
    detailSubmissions.innerHTML = `<strong>${p.submitted_count}</strong> / ${p.max_capacity} (${p.fill_percentage}% filled)`;
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
    } else {
      bookmarks.add(id);
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
    viewSavedLink.textContent = `Show Saved Only (${bookmarks.size})`;
    viewSavedLink.style.fontWeight = 'normal';
    render();
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

})();
