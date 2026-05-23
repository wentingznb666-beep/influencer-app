// 登录认证模块
const auth = {
  // 初始化 LIFF
  async init() {
    try {
      await liff.init({ liffId: '2010170295-TZkdNwDc' });
      console.log('LIFF 初始化成功');
      return true;
    } catch (error) {
      console.error('LIFF 初始化失败:', error);
      return false;
    }
  },

  // 检查是否登录
  isLoggedIn() {
    return !!getToken();
  },

  // 检查 LIFF 是否登录
  isLiffLoggedIn() {
    return liff.isLoggedIn();
  },

  // LINE 登录
  login() {
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  },

  // 登出
  logout() {
    clearToken();
    if (liff.isLoggedIn()) {
      liff.logout();
    }
    window.location.href = '/liff/pages/login.html';
  },

  // 获取 LINE 用户信息
  async getLineProfile() {
    try {
      if (!liff.isLoggedIn()) {
        return null;
      }
      return await liff.getProfile();
    } catch (error) {
      console.error('获取 LINE 用户信息失败:', error);
      return null;
    }
  },

  // 自动登录
  async autoLogin() {
    // 如果已经登录，直接返回
    if (this.isLoggedIn()) {
      return true;
    }

    // 如果 LIFF 已登录，尝试自动登录
    if (liff.isLoggedIn()) {
      try {
        const accessToken = liff.getAccessToken();
        const response = await api.lineLogin(accessToken);
        
        if (response && response.accessToken) {
          setToken(response.accessToken);
          localStorage.setItem('liff_user', JSON.stringify(response.user));
          return true;
        }
      } catch (error) {
        console.error('自动登录失败:', error);
      }
    }

    return false;
  },

  // 获取当前用户
  getCurrentUser() {
    const userStr = localStorage.getItem('liff_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // 检查权限
  checkPermission() {
    const user = this.getCurrentUser();
    if (!user) {
      return false;
    }
    // 检查是否是达人角色
    return user.role === 'influencer' || user.role === 'admin';
  },
};

// 导出
window.auth = auth;
