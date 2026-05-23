// API 调用模块
const API_BASE_URL = 'https://xiangtaiyyj.site/api';

// 获取存储的 token
function getToken() {
  return localStorage.getItem('liff_access_token');
}

// 设置 token
function setToken(token) {
  localStorage.setItem('liff_access_token', token);
}

// 清除 token
function clearToken() {
  localStorage.removeItem('liff_access_token');
  localStorage.removeItem('liff_user');
}

// 通用请求方法
async function request(url, options = {}) {
  const token = getToken();
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);
    
    if (response.status === 401) {
      clearToken();
      window.location.href = '/liff-app/pages/login.html';
      return null;
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || '请求失败');
    }
    
    return data;
  } catch (error) {
    console.error('API 请求失败:', error);
    throw error;
  }
}

// API 方法
const api = {
  // 登录
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),

  // LINE 登录
  lineLogin: (accessToken) => request('/auth/line-login', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  }),

  // 获取用户信息
  getMe: () => request('/auth/me'),

  // 任务列表
  getTasks: () => request('/influencer/tasks'),

  // 领取任务
  claimTask: (taskId) => request(`/influencer/tasks/${taskId}/claim`, {
    method: 'POST',
  }),

  // 我的任务
  getMyClaims: () => request('/influencer/my-claims'),

  // 任务详情
  getMyClaim: (claimId) => request(`/influencer/my-claims/${claimId}`),

  // 提交任务
  submitTask: (data) => request('/influencer/submissions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 积分
  getPoints: () => request('/influencer/points'),

  // 提现记录
  getWithdrawals: () => request('/influencer/withdrawals'),

  // 申请提现
  requestWithdrawal: (data) => request('/influencer/withdrawals', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 商单列表
  getMarketOrders: () => request('/influencer/market-orders'),

  // 我的商单
  getMyMarketOrders: () => request('/influencer/market-orders/my'),

  // 领取商单
  claimMarketOrder: (orderId) => request(`/influencer/market-orders/${orderId}/claim`, {
    method: 'POST',
  }),

  // 完成商单
  completeMarketOrder: (orderId, data) => request(`/influencer/market-orders/${orderId}/complete`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 发布商单
  publishMarketOrder: (orderId, data) => request(`/influencer/market-orders/${orderId}/publish`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// 导出
window.api = api;
