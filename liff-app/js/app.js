// 主应用模块
const app = {
  // 初始化应用
  async init() {
    console.log('初始化应用...');

    // 初始化 LIFF
    const liffInitialized = await auth.init();
    if (!liffInitialized) {
      utils.showToast('初始化失败，请重试', 'error');
      return;
    }

    // 尝试自动登录
    const loggedIn = await auth.autoLogin();
    if (!loggedIn) {
      // 跳转到登录页面
      window.location.href = '/liff-app/pages/login.html';
      return;
    }

    // 检查权限
    if (!auth.checkPermission()) {
      utils.showToast('权限不足', 'error');
      auth.logout();
      return;
    }

    // 隐藏加载中，显示主内容
    utils.hideLoading();
    document.getElementById('main-content').style.display = 'block';

    // 加载首页
    this.loadPage('home');

    // 绑定导航事件
    this.bindNavigation();

    console.log('应用初始化完成');
  },

  // 绑定导航事件
  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.loadPage(page);
      });
    });
  },

  // 加载页面
  async loadPage(pageName) {
    const pageContent = document.getElementById('page-content');
    
    try {
      // 显示加载中
      pageContent.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

      // 加载页面内容
      const response = await fetch(`/liff-app/pages/${pageName}.html`);
      const html = await response.text();
      
      // 插入页面内容
      pageContent.innerHTML = html;

      // 执行页面脚本
      const scripts = pageContent.querySelectorAll('script');
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        newScript.textContent = script.textContent;
        document.body.appendChild(newScript);
      });

      // 更新导航状态
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
          item.classList.add('active');
        }
      });

    } catch (error) {
      console.error('加载页面失败:', error);
      pageContent.innerHTML = '<div class="empty"><div class="empty-icon">😢</div><div class="empty-text">加载失败，请重试</div></div>';
    }
  },

  // 任务列表
  async loadTasks() {
    try {
      const tasks = await api.getTasks();
      return tasks;
    } catch (error) {
      console.error('获取任务列表失败:', error);
      utils.showToast('获取任务列表失败', 'error');
      return [];
    }
  },

  // 领取任务
  async claimTask(taskId) {
    try {
      const confirmed = await utils.confirm('确定要领取这个任务吗？');
      if (!confirmed) return false;

      const result = await api.claimTask(taskId);
      utils.showToast('领取成功', 'success');
      return true;
    } catch (error) {
      console.error('领取任务失败:', error);
      utils.showToast(error.message || '领取失败', 'error');
      return false;
    }
  },

  // 我的任务
  async loadMyClaims() {
    try {
      const claims = await api.getMyClaims();
      return claims;
    } catch (error) {
      console.error('获取我的任务失败:', error);
      utils.showToast('获取我的任务失败', 'error');
      return [];
    }
  },

  // 商单列表
  async loadMarketOrders() {
    try {
      const orders = await api.getMarketOrders();
      return orders;
    } catch (error) {
      console.error('获取商单列表失败:', error);
      utils.showToast('获取商单列表失败', 'error');
      return [];
    }
  },

  // 我的商单
  async loadMyMarketOrders() {
    try {
      const orders = await api.getMyMarketOrders();
      return orders;
    } catch (error) {
      console.error('获取我的商单失败:', error);
      utils.showToast('获取我的商单失败', 'error');
      return [];
    }
  },

  // 积分信息
  async loadPoints() {
    try {
      const points = await api.getPoints();
      return points;
    } catch (error) {
      console.error('获取积分信息失败:', error);
      utils.showToast('获取积分信息失败', 'error');
      return null;
    }
  },

  // 提现记录
  async loadWithdrawals() {
    try {
      const withdrawals = await api.getWithdrawals();
      return withdrawals;
    } catch (error) {
      console.error('获取提现记录失败:', error);
      utils.showToast('获取提现记录失败', 'error');
      return [];
    }
  },
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// 导出
window.app = app;
