// 工具函数模块
const utils = {
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '';
    return `${this.formatDate(dateStr)} ${this.formatTime(dateStr)}`;
  },

  formatAmount(amount) {
    if (amount == null) return '0.00';
    return Number(amount).toFixed(2);
  },

  formatPoints(points) {
    if (points == null) return '0';
    return Number(points).toLocaleString();
  },

  truncateText(text, max = 50) {
    if (!text) return '';
    return text.length <= max ? text : text.substring(0, max) + '...';
  },

  showToast(message, type = 'info') {
    // Remove existing toast
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  },

  confirm(message) {
    return new Promise(resolve => resolve(window.confirm(message)));
  },

  showLoading() {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'flex';
  },

  hideLoading() {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
  },

  getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  },

  throttle(fn, limit) {
    let ok = true;
    return (...args) => { if (ok) { fn(...args); ok = false; setTimeout(() => ok = true, limit); } };
  },
};

window.utils = utils;
