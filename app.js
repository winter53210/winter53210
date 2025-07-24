// ========== API 客户端 ==========
    class APIClient {
      constructor() {
        this.baseURL = window.location.origin + '/api';
        this.token = localStorage.getItem('auth_token');
        this.isOnline = navigator.onLine;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.setupNetworkMonitoring();
      }

      setupNetworkMonitoring() {
        window.addEventListener('online', () => {
          this.isOnline = true;
          document.getElementById('offlineIndicator').classList.add('hidden');
          document.getElementById('connectionStatus').textContent = '已连接';
          document.getElementById('connectionStatus').className = 'font-medium text-green-600';
          showNotification('网络连接已恢复', 'success');
        });

        window.addEventListener('offline', () => {
          this.isOnline = false;
          document.getElementById('offlineIndicator').classList.remove('hidden');
          document.getElementById('connectionStatus').textContent = '已断开';
          document.getElementById('connectionStatus').className = 'font-medium text-red-600';
          showNotification('网络连接已断开', 'warning');
        });
      }

      setToken(token) {
        this.token = token;
        if (token) {
          localStorage.setItem('auth_token', token);
        } else {
          localStorage.removeItem('auth_token');
        }
      }

      getHeaders() {
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
      }

      async request(method, endpoint, data = null) {
        if (!this.isOnline) {
          throw new Error('网络连接不可用');
        }

        const url = `${this.baseURL}${endpoint}`;
        const options = {
          method,
          headers: this.getHeaders()
        };

        if (data) {
          options.body = JSON.stringify(data);
        }

        try {
          const response = await fetch(url, options);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}`);
          }

          this.retryCount = 0;
          return await response.json();
        } catch (error) {
          console.error(`API请求失败 (${method} ${endpoint}):`, error);
          
          if (this.retryCount < this.maxRetries && error.message.includes('fetch')) {
            this.retryCount++;
            console.log(`正在重试 ${this.retryCount}/${this.maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
            return this.request(method, endpoint, data);
          }
          
          throw error;
        }
      }

      // 用户认证相关
      async register(username, password, email = '') {
        return this.request('POST', '/register', { username, password, email });
      }

      async login(username, password) {
        const result = await this.request('POST', '/login', { username, password });
        if (result.success && result.token) {
          this.setToken(result.token);
        }
        return result;
      }

      async getUserProfile() {
        return this.request('GET', '/user/profile');
      }

      // 记忆相关
      async getMemories(view = 'all') {
        return this.request('GET', `/memories?view=${view}`);
      }

      async createMemory(memoryData) {
        return this.request('POST', '/memories', memoryData);
      }

      async updateMemory(id, memoryData) {
        return this.request('PUT', `/memories/${id}`, memoryData);
      }

      async deleteMemory(id) {
        return this.request('DELETE', `/memories/${id}`);
      }

      async toggleLike(memoryId) {
        return this.request('POST', `/memories/${memoryId}/like`);
      }

      // 数据导出/导入
      async exportUserData() {
        return this.request('GET', '/user/export');
      }

      async importUserData(data) {
        return this.request('POST', '/user/import', { data });
      }

      async getUserStats() {
        return this.request('GET', '/user/stats');
      }

      logout() {
        this.setToken(null);
      }
    }

    // ========== 图片处理工具 ==========
    class ImageHandler {
      static async fileToBase64(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      static async resizeImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
        return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            let { width, height } = img;
            
            if (width > height) {
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          
          img.src = URL.createObjectURL(file);
        });
      }

      static validateImageFile(file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!allowedTypes.includes(file.type)) {
          return { valid: false, message: '不支持的图片格式' };
        }
        
        if (file.size > maxSize) {
          return { valid: false, message: '图片大小不能超过5MB' };
        }
        
        return { valid: true };
      }
    }

    // ========== 通知系统 ==========
    function showNotification(message, type = 'info') {
      const container = document.getElementById('notificationContainer');
      const notification = document.createElement('div');
      
      const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
      };

      notification.className = `notification ${colors[type]} text-white p-4 rounded-lg shadow-lg`;
      notification.innerHTML = `
        <div class="flex items-center justify-between">
          <span>${message}</span>
          <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">&times;</button>
        </div>
      `;

      container.appendChild(notification);

      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 5000);
    }

    // ========== 实时点赞功能 ==========
    function updateLikeButtonUI(memoryId, likeData) {
      const infoWindowLikeButtons = document.querySelectorAll(`[onclick="toggleLike(${memoryId})"]`);
      
      infoWindowLikeButtons.forEach(button => {
        const isLiked = likeData.liked;
        const likeCount = likeData.likeCount;
        
        button.classList.add('like-animation');
        
        button.style.color = isLiked ? '#ef4444' : '#6b7280';
        button.innerHTML = `${isLiked ? '❤️' : '🤍'} ${likeCount}`;
        
        setTimeout(() => {
          button.classList.remove('like-animation');
        }, 600);
      });
      
      updateDetailModalLikeButton(memoryId, likeData);
    }

    function updateDetailModalLikeButton(memoryId, likeData) {
      if (currentMemoryId === memoryId) {
        const detailLikeButton = document.querySelector('#memoryDetailContent [onclick="toggleLike(' + memoryId + ')"]');
        
        if (detailLikeButton) {
          const isLiked = likeData.liked;
          const likeCount = likeData.likeCount;
          
          detailLikeButton.classList.add('like-animation');
          
          if (isLiked) {
            detailLikeButton.classList.add('liked');
          } else {
            detailLikeButton.classList.remove('liked');
          }
          
          detailLikeButton.innerHTML = `${isLiked ? '❤️' : '🤍'} ${likeCount} 个赞`;
          
          setTimeout(() => {
            detailLikeButton.classList.remove('like-animation');
          }, 600);
        }
      }
    }

    // ========== 地图模式切换功能（简化版） ==========
    function switchMapMode(mode) {
      try {
        document.querySelectorAll('.map-mode-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        switch(mode) {
          case 'normal':
            map.setMapType(BMAP_NORMAL_MAP);
            showNotification('已切换到普通地图模式', 'info');
            break;
            
          case 'satellite':
            map.setMapType(BMAP_SATELLITE_MAP);
            showNotification('已切换到卫星地图模式', 'info');
            break;
            
          default:
            map.setMapType(BMAP_NORMAL_MAP);
            showNotification('已切换到普通地图模式', 'info');
        }

        console.log(`地图模式已切换到: ${mode}`);
      } catch (error) {
        console.error('地图模式切换失败:', error);
        showNotification('地图模式切换失败，请重试', 'error');
      }
    }

    // ========== 坐标精度管理 ==========
    class CoordinateManager {
      static ensurePrecision(coord, decimals = 6) {
        if (typeof coord !== 'number') {
          coord = parseFloat(coord);
        }
        return Number.isFinite(coord) ? parseFloat(coord.toFixed(decimals)) : null;
      }

      static isValidLngLat(lng, lat) {
        const lngNum = parseFloat(lng);
        const latNum = parseFloat(lat);
        return (
          Number.isFinite(lngNum) &&
          Number.isFinite(latNum) &&
          lngNum >= -180 && lngNum <= 180 &&
          latNum >= -90 && latNum <= 90
        );
      }

      static validateCoordinates(lng, lat) {
        if (!this.isValidLngLat(lng, lat)) {
          throw new Error('无效的经纬度');
        }
        return {
          longitude: this.ensurePrecision(lng, 6),
          latitude: this.ensurePrecision(lat, 6)
        };
      }

      static calculateDistance(lng1, lat1, lng2, lat2) {
        const R = 6371000;
        const toRad = deg => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }
    }

    // ========== 修复后的情绪按钮处理函数 ==========
    let emotionButtonsInitialized = false; // 防止重复初始化

    function setupEmotionButtons() {
      // 防止重复初始化
      if (emotionButtonsInitialized) {
        console.log('情绪按钮已初始化，跳过重复设置');
        return;
      }

      console.log('开始初始化情绪按钮...');
      
      const emotionButtons = document.querySelectorAll('.emotion-btn');
      console.log('找到情绪按钮数量:', emotionButtons.length);

      emotionButtons.forEach((btn, index) => {
        // 移除所有可能的旧事件监听器
        btn.replaceWith(btn.cloneNode(true));
      });

      // 重新获取克隆后的按钮
      const newEmotionButtons = document.querySelectorAll('.emotion-btn');
      
      newEmotionButtons.forEach((btn, index) => {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const emotion = this.getAttribute('data-value');
          console.log(`情绪按钮被点击: ${emotion} (索引: ${index})`);
          
          // 清除所有按钮的选中状态
          newEmotionButtons.forEach(b => {
            b.classList.remove('bg-blue-200', 'border-blue-500', 'ring-2', 'ring-blue-300');
            b.style.backgroundColor = '';
            b.style.borderColor = '';
          });
          
          // 设置当前按钮为选中状态
          this.classList.add('bg-blue-200', 'border-blue-500', 'ring-2', 'ring-blue-300');
          this.style.backgroundColor = '#dbeafe'; // 确保背景色生效
          this.style.borderColor = '#3b82f6'; // 确保边框色生效
          
          console.log('情绪选择已更新为:', emotion);
          console.log('按钮当前类名:', this.className);
          
          // 触发自定义事件，用于调试
          const event = new CustomEvent('emotionSelected', { 
            detail: { emotion: emotion, button: this } 
          });
          document.dispatchEvent(event);
        });
        
        console.log(`情绪按钮 ${btn.getAttribute('data-value')} 事件监听器已添加`);
      });

      emotionButtonsInitialized = true;
      console.log('情绪按钮初始化完成');
    }

    // 重置情绪按钮状态
    function resetEmotionButtons() {
      console.log('重置情绪按钮状态');
      document.querySelectorAll('.emotion-btn').forEach(btn => {
        btn.classList.remove('bg-blue-200', 'border-blue-500', 'ring-2', 'ring-blue-300');
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
      });
    }

    // 设置特定情绪为选中状态
    function setEmotionSelected(emotion) {
      console.log('设置情绪选中状态:', emotion);
      
      // 先重置所有按钮
      resetEmotionButtons();
      
      // 查找并选中指定情绪的按钮
      const targetButton = document.querySelector(`[data-value="${emotion}"]`);
      if (targetButton) {
        targetButton.classList.add('bg-blue-200', 'border-blue-500', 'ring-2', 'ring-blue-300');
        targetButton.style.backgroundColor = '#dbeafe';
        targetButton.style.borderColor = '#3b82f6';
        console.log('成功设置情绪按钮选中状态:', emotion);
        return true;
      } else {
        console.error('未找到情绪按钮:', emotion);
        return false;
      }
    }

    // 获取当前选中的情绪
    function getSelectedEmotion() {
      const selectedBtn = document.querySelector('.emotion-btn.bg-blue-200') || 
                         document.querySelector('.emotion-btn.border-blue-500') ||
                         document.querySelector('.emotion-btn.ring-2');
      
      if (selectedBtn) {
        const emotion = selectedBtn.getAttribute('data-value');
        console.log('当前选中的情绪:', emotion);
        return emotion;
      } else {
        console.log('未找到选中的情绪按钮');
        return null;
      }
    }

    // ========== 全局变量 ==========
    let map;
    let tempMarker = null;
    let isCreating = false;
    let allMemories = [];
    let filteredMemories = [];
    let currentMarkers = [];
    let apiClient = new APIClient();
    let currentMemoryId = null;
    let currentViewMode = 'all';
    let userLocationMarker = null;
    let selectedImages = [];
    let isEditMode = false;
    let editingMemoryId = null;
    let newMemoryMarker = null;
    let currentUser = null;

    // ========== 认证相关函数 ==========
    function showLoginForm() {
      document.getElementById('loginForm').classList.remove('hidden');
      document.getElementById('registerForm').classList.add('hidden');
      document.getElementById('loginForm').classList.add('slide-up');
    }

    function showRegisterForm() {
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('registerForm').classList.remove('hidden');
      document.getElementById('registerForm').classList.add('slide-up');
    }

    async function handleLogin(event) {
      event.preventDefault();
      
      const submitBtn = document.getElementById('loginSubmitBtn');
      const originalText = submitBtn.textContent;
      
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value.trim();

      if (!username || !password) {
        showNotification('请填写用户名和密码', 'warning');
        return;
      }

      submitBtn.innerHTML = '<span class="loading">⏳</span> 登录中...';
      submitBtn.disabled = true;

      try {
        const result = await apiClient.login(username, password);
        if (result.success) {
          currentUser = result.user;
          document.getElementById('currentUser').textContent = `欢迎，${result.user.username}`;
          document.getElementById('sidebarCurrentUser').textContent = result.user.username;
          showNotification(`欢迎回来，${result.user.username}！`, 'success');
          showMainApp();
        } else {
          showNotification(result.message, 'error');
        }
      } catch (error) {
        console.error('登录失败:', error);
        showNotification('登录失败：' + error.message, 'error');
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }

    async function handleRegister(event) {
      event.preventDefault();
      
      const submitBtn = document.getElementById('registerSubmitBtn');
      const originalText = submitBtn.textContent;
      
      const username = document.getElementById('registerUsername').value.trim();
      const password = document.getElementById('registerPassword').value.trim();
      const confirmPassword = document.getElementById('confirmPassword').value.trim();
      const email = document.getElementById('registerEmail').value.trim();

      if (!username || !password || !confirmPassword) {
        showNotification('请填写所有必填字段', 'warning');
        return;
      }

      if (password !== confirmPassword) {
        showNotification('两次输入的密码不一致', 'error');
        return;
      }

      submitBtn.innerHTML = '<span class="loading">⏳</span> 注册中...';
      submitBtn.disabled = true;

      try {
        const registerResult = await apiClient.register(username, password, email);
        if (registerResult.success) {
          const loginResult = await apiClient.login(username, password);
          if (loginResult.success) {
            currentUser = loginResult.user;
            document.getElementById('currentUser').textContent = `欢迎，${loginResult.user.username}`;
            document.getElementById('sidebarCurrentUser').textContent = loginResult.user.username;
            showNotification(`注册成功！欢迎加入城市记忆，${loginResult.user.username}！`, 'success');
            showMainApp();
          }
        } else {
          showNotification(registerResult.message, 'error');
        }
      } catch (error) {
        console.error('注册失败:', error);
        showNotification('注册失败：' + error.message, 'error');
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }

    function handleLogout() {
      if (confirm('确定要退出登录吗？')) {
        apiClient.logout();
        currentUser = null;
        showNotification('已退出登录，期待您的再次访问！', 'info');
        showAuthPage();
      }
    }

    function showMainApp() {
      document.getElementById('authPage').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
      initializeMainApp();
    }

    function showAuthPage() {
      document.getElementById('authPage').classList.remove('hidden');
      document.getElementById('mainApp').classList.add('hidden');
      
      document.querySelectorAll('form').forEach(form => form.reset());
    }

    // ========== 主应用初始化 ==========
    function initializeMainApp() {
      if (!map) {
        try {
          // 使用传统百度地图API
          map = new BMap.Map("map");
          const chinaCenter = new BMap.Point(104.1954, 35.8617);
          map.centerAndZoom(chinaCenter, 5);
          map.enableScrollWheelZoom(true);

          map.enableInertialDragging();
          map.enableContinuousZoom();

          map.addEventListener('zoomend', function() {
            console.log('地图缩放结束');
          });

          map.addEventListener('moveend', function() {
            console.log('地图移动结束');
          });

          // 确保地图控制面板在首页时是可见的
          const mapControls = document.querySelector('.map-controls');
          if (mapControls) {
            mapControls.style.display = 'block';
          }

          
          // 修复：检查导出/导入按钮是否存在
          const exportBtn = document.getElementById('exportDataBtn');
          if (exportBtn) {
            exportBtn.addEventListener('click', exportData);
          }
          
          const importBtn = document.getElementById('importDataBtn');
          if (importBtn) {
            importBtn.addEventListener('click', () => {
              document.getElementById('importFileInput').click();
            });
          }
          
          const importFileInput = document.getElementById('importFileInput');
          if (importFileInput) {
            importFileInput.addEventListener('change', importData);
          }

          // 修复：检查图片上传元素是否存在
          const memImagesInput = document.getElementById('mem-images');
          if (memImagesInput) {
            memImagesInput.addEventListener('change', handleImageSelection);
          }

          document.querySelectorAll('.filter-emotion-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              this.classList.toggle('bg-blue-200');
              this.classList.toggle('border-blue-500');
            });
          });

          console.log('百度地图初始化成功');
          
          // 只在这里初始化一次情绪按钮
          setupEmotionButtons();
          
          
        } catch (error) {
          console.error('地图初始化失败:', error);
          showNotification('地图加载失败，请刷新页面重试', 'error');
        }
      }
      loadAllMemories();
      setupFilterEmotionButtons(); 
    }

    // ========== 图片处理函数（修复版本） ==========
    async function handleImageSelection(event) {
      const files = Array.from(event.target.files);
      const previewContainer = document.getElementById('image-preview');
      
      // 检查预览容器是否存在
      if (!previewContainer) {
        console.warn('图片预览容器不存在');
        return;
      }
      
      for (const file of files) {
        const validation = ImageHandler.validateImageFile(file);
        if (!validation.valid) {
          showNotification(validation.message, 'error');
          continue;
        }

        try {
          const compressedBase64 = await ImageHandler.resizeImage(file);
          
          const previewDiv = document.createElement('div');
          previewDiv.className = 'image-preview-container';
          
          const img = document.createElement('img');
          img.src = compressedBase64;
          img.className = 'image-preview';
          
          const removeBtn = document.createElement('button');
          removeBtn.className = 'image-remove-btn';
          removeBtn.innerHTML = '×';
          removeBtn.onclick = () => {
            previewDiv.remove();
            selectedImages = selectedImages.filter(img => img !== compressedBase64);
          };
          
          previewDiv.appendChild(img);
          previewDiv.appendChild(removeBtn);
          previewContainer.appendChild(previewDiv);
          
          selectedImages.push(compressedBase64);
        } catch (error) {
          console.error('图片处理失败:', error);
          showNotification('图片处理失败', 'error');
        }
      }
    }

    function clearImagePreviews() {
      const previewContainer = document.getElementById('image-preview');
      const memImagesInput = document.getElementById('mem-images');
      
      if (previewContainer) {
        previewContainer.innerHTML = '';
      }
      
      selectedImages = [];
      
      if (memImagesInput) {
        memImagesInput.value = '';
      }
    }

    // ========== 地图和界面逻辑 ==========
    function toggleCreateMode() {
      isCreating = !isCreating;
      const btn = document.getElementById('createMemoryBtn');
      const mapEl = document.getElementById('map');
      
      if (isCreating) {
        btn.textContent = '❌ 取消创建';
        btn.classList.remove('map-control-btn');
        btn.classList.add('map-control-btn', 'active');
        mapEl.classList.add('crosshair-cursor');
        map.addEventListener("click", onMapClick);
        showNotification('请在地图上点击选择位置创建记忆点', 'info');
      } else {
        btn.textContent = '➕ 创建记忆点';
        btn.classList.remove('active');
        mapEl.classList.remove('crosshair-cursor');
        map.removeEventListener("click", onMapClick);
        
        if (tempMarker) {
          map.removeOverlay(tempMarker);
          tempMarker = null;
        }
      }
    }

    // ========== 点击地图获取坐标（传统API版本） ==========
    function onMapClick(e) {
      if (!isCreating) return;

      console.log('传统地图点击事件:', e);
      
      let lng, lat;
      
      if (e.point) {
        lng = e.point.lng;
        lat = e.point.lat;
        console.log('从传统API获取坐标:', { lng, lat });
      } else {
        console.error('无法获取点击坐标', e);
        showNotification('无法获取点击坐标，请重试', 'error');
        return;
      }

      // 验证坐标范围
      if (typeof lng !== 'number' || typeof lat !== 'number' || 
          isNaN(lng) || isNaN(lat) ||
          Math.abs(lng) > 180 || Math.abs(lat) > 90) {
        console.error('获取到无效坐标:', { lng, lat });
        showNotification('获取到无效坐标：' + lng + ', ' + lat, 'error');
        return;
      }

      try {
        const validatedCoords = CoordinateManager.validateCoordinates(lng, lat);

        console.log('验证后坐标:', validatedCoords);

        showNotification(
          `📍 选择的位置坐标：\n经度: ${validatedCoords.longitude}°\n纬度: ${validatedCoords.latitude}°`, 
          'success'
        );

        const processedPoint = new BMap.Point(validatedCoords.longitude, validatedCoords.latitude);

        if (tempMarker) {
          map.removeOverlay(tempMarker);
        }

        tempMarker = new BMap.Marker(processedPoint);
        map.addOverlay(tempMarker);
        tempMarker._processedCoords = validatedCoords;

        showModal();

      } catch (error) {
        console.error('坐标处理错误:', error);
        showNotification('坐标处理失败: ' + error.message, 'error');
      }
    }

    // ========== 修复后的模态框显示函数 ==========
    function showModal() {
      console.log('显示创建记忆模态框');
      
      resetModalToCreateMode();
      document.getElementById("createMemoryModal").classList.remove("hidden");
      
      // 重置表单字段
      document.getElementById("mem-title").value = "";
      document.getElementById("mem-theme").value = "";
      document.getElementById("mem-desc").value = "";
      document.getElementById("mem-date").value = new Date().toISOString().split('T')[0];
      document.querySelector('input[name="privacy"][value="public"]').checked = true;

      // 清理图片相关
      clearImagePreviews();

      // 重置情绪按钮状态
      emotionButtonsInitialized = false; // 允许重新初始化
      resetEmotionButtons();
      
      // 重新初始化情绪按钮
      setTimeout(() => {
        setupEmotionButtons();
      }, 100); // 短暂延迟确保DOM更新完成
    }

    function resetModalToCreateMode() {
      isEditMode = false;
      editingMemoryId = null;
      document.getElementById('modalTitle').textContent = '✨ 创建记忆点';
      document.getElementById('submitBtn').textContent = '✅ 确定创建';
      document.getElementById('submitBtn').className = 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition duration-200';
    }

    function hideModal() {
      document.getElementById("createMemoryModal").classList.add("hidden");
      if (tempMarker && !isEditMode) {
        map.removeOverlay(tempMarker);
        tempMarker = null;
      }
      clearImagePreviews();
      resetModalToCreateMode();
    }

    // ========== 编辑记忆功能 ==========
    function editMemory() {
      if (!currentMemoryId) return;
      
      const memory = allMemories.find(m => m.id === currentMemoryId);
      if (!memory) {
        showNotification('记忆不存在', 'error');
        return;
      }

      if (!currentUser || memory.username !== currentUser.username) {
        showNotification('您没有权限编辑此记忆', 'error');
        return;
      }

      isEditMode = true;
      editingMemoryId = currentMemoryId;
      
      document.getElementById('modalTitle').textContent = '✏️ 编辑记忆点';
      document.getElementById('submitBtn').textContent = '💾 保存修改';
      document.getElementById('submitBtn').className = 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200';

      populateFormWithMemoryData(memory);

      hideMemoryDetail();
      document.getElementById("createMemoryModal").classList.remove("hidden");
    }

    // ========== 修复后的表单数据填充函数 ==========
    function populateFormWithMemoryData(memory) {
      console.log('填充表单数据:', memory);
      
      // 填充基本字段
      document.getElementById("mem-title").value = memory.title;
      document.getElementById("mem-theme").value = memory.theme;
      document.getElementById("mem-desc").value = memory.description || '';
      document.getElementById("mem-date").value = memory.date;

      // 设置隐私选项
      if (memory.privacy === 'private') {
        document.querySelector('input[name="privacy"][value="private"]').checked = true;
      } else {
        document.querySelector('input[name="privacy"][value="public"]').checked = true;
      }

      // 处理图片
      if (memory.images && memory.images.length > 0) {
        selectedImages = [...memory.images];
        displayExistingImages();
      } else {
        selectedImages = [];
      }

      // 重置并设置情绪选择
      emotionButtonsInitialized = false; // 允许重新初始化
      
      setTimeout(() => {
        setupEmotionButtons();
        
        // 再次延迟设置选中状态，确保事件监听器已设置完成
        setTimeout(() => {
          const success = setEmotionSelected(memory.emotion);
          if (!success) {
            console.error('设置情绪选中状态失败:', memory.emotion);
          }
        }, 200);
      }, 100);
    }

    // ========== 显示已有图片（修复版本） ==========
    function displayExistingImages() {
      const previewContainer = document.getElementById('image-preview');
      
      // 如果图片预览容器不存在，直接返回
      if (!previewContainer) {
        console.warn('图片预览容器不存在，跳过图片显示');
        return;
      }
      
      previewContainer.innerHTML = '';

      selectedImages.forEach((imageSrc, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview-container';
        
        const img = document.createElement('img');
        img.src = imageSrc;
        img.className = 'image-preview';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'image-remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => {
          previewDiv.remove();
          selectedImages = selectedImages.filter(img => img !== imageSrc);
        };
        
        previewDiv.appendChild(img);
        previewDiv.appendChild(removeBtn);
        previewContainer.appendChild(previewDiv);
      });
    }

    // ========== 修复后的表单提交函数 ==========
    async function handleSubmit(event) {
      event.preventDefault();
      
      const submitBtn = document.getElementById('submitBtn');
      const originalText = submitBtn.textContent;
      
      // 获取表单数据
      const title = document.getElementById("mem-title").value.trim();
      const theme = document.getElementById("mem-theme").value;
      const desc = document.getElementById("mem-desc").value.trim();
      const date = document.getElementById("mem-date").value;
      const privacy = document.querySelector('input[name="privacy"]:checked').value;
      
      // 获取选中的情绪
      const emotion = getSelectedEmotion();
      
      if (!emotion) {
        showNotification('请选择心情', 'warning');
        console.error('未选择情绪，当前按钮状态:');
        document.querySelectorAll('.emotion-btn').forEach((btn, index) => {
          console.log(`按钮${index}: ${btn.getAttribute('data-value')}, 类名: ${btn.className}`);
        });
        return;
      }
      
      console.log('选中的情绪:', emotion);

      // 验证其他必填字段
      if (!title) {
        showNotification('请填写标题', 'warning');
        return;
      }

      if (!theme) {
        showNotification('请选择主题', 'warning');
        return;
      }

      submitBtn.innerHTML = '<span class="loading">⏳</span> 处理中...';
      submitBtn.disabled = true;

      try {
        if (isEditMode) {
          // 编辑模式的处理逻辑
          const originalMemory = allMemories.find(m => m.id === editingMemoryId);
          if (!originalMemory) {
            showNotification('无法找到原始记忆数据', 'error');
            return;
          }

          const updateData = {
            title: title,
            theme: theme,
            emotion: emotion,
            description: desc,
            date: date,
            privacy: privacy,
            images: selectedImages
          };

          console.log('更新数据:', updateData);

          const result = await apiClient.updateMemory(editingMemoryId, updateData);
          
          if (result.success) {
            console.log('记忆更新成功:', result.memory);
            hideModal();
            showNotification(`记忆点"${title}"更新成功！`, 'success');
            
            // 更新本地数据
            const memoryIndex = allMemories.findIndex(m => m.id === editingMemoryId);
            if (memoryIndex !== -1) {
              allMemories[memoryIndex] = { 
                ...allMemories[memoryIndex], 
                ...updateData,
                longitude: originalMemory.longitude,
                latitude: originalMemory.latitude,
                username: originalMemory.username,
                createdAt: originalMemory.createdAt,
                updatedAt: result.memory.updatedAt || new Date().toISOString()
              };
            }
            
            // 重新加载数据
            if (currentViewMode === 'all') {
              await loadAllMemories();
            } else {
              await loadMyMemories();
            }
          } else {
            console.error('更新失败:', result);
            showNotification('更新失败：' + result.message, 'error');
          }
        } else {
          // 创建模式的处理逻辑
          if (!tempMarker) {
            showNotification('请先在地图上选择位置', 'warning');
            return;
          }

          const position = tempMarker.getPosition();
          
          const memoryData = {
            title: title,
            theme: theme,
            emotion: emotion,
            description: desc,
            longitude: position.lng,
            latitude: position.lat,
            date: date,
            privacy: privacy,
            images: selectedImages
          };

          console.log('正在创建记忆:', memoryData);

          const result = await apiClient.createMemory(memoryData);
          
          if (result.success) {
            console.log('记忆创建成功:', result.memory);
            
            newMemoryMarker = {
              id: result.id,
              position: position
            };
            
            hideModal();
            toggleCreateMode();
            showNotification(`记忆点"${title}"创建成功！已保存到数据库`, 'success');
            
            if (currentViewMode === 'all') {
              await loadAllMemories();
            } else {
              await loadMyMemories();
            }
            
            setTimeout(() => {
              map.centerAndZoom(position, 15);
              showNotification(`🎯 已跳转到新创建的记忆点位置`, 'info');
            }, 500);
          } else {
            showNotification('创建失败：' + result.message, 'error');
          }
        }
      } catch (error) {
        console.error('操作失败:', error);
        showNotification('操作失败：' + error.message, 'error');
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }

    // ========== 标记显示功能（使用传统API） ==========
    function displayMemories(memories) {
      currentMarkers.forEach(marker => {
        map.removeOverlay(marker);
      });
      currentMarkers = [];

      console.log(`开始显示 ${memories.length} 个记忆点标记`);

      memories.forEach((memory, index) => {
        const point = new BMap.Point(memory.longitude, memory.latitude);
        const marker = new BMap.Marker(point);
        
        if (newMemoryMarker && newMemoryMarker.id === memory.id) {
          setTimeout(() => {
            newMemoryMarker = null;
          }, 3000);
        }
        
        map.addOverlay(marker);
        currentMarkers.push(marker);
        
        const userInfo = currentViewMode === 'all' ? `<div style="font-size: 11px; color: #888; margin-bottom: 4px;">👤 ${memory.username}</div>` : '';
        
        const privacyBadge = memory.privacy === 'private' ? 
          '<span class="privacy-badge privacy-private">🔒 私密</span>' : 
          '<span class="privacy-badge privacy-public">🌍 公开</span>';
        
        const imageGallery = memory.images && memory.images.length > 0 ? 
          `<div class="info-window-gallery">
            ${memory.images.slice(0, 3).map(img => 
              `<img src="${img}" onclick="openImageModal('${img}')" class="info-window-image">`
            ).join('')}
            ${memory.images.length > 3 ? `<div style="font-size: 10px; color: #888; grid-column: span 3; text-align: center; margin-top: 4px;">+${memory.images.length - 3} 更多</div>` : ''}
          </div>` : '';
        
        const infoContent = `
          <div style="padding: 12px; min-width: 220px; font-family: Arial, sans-serif;">
            ${userInfo}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="margin: 0; font-weight: bold; color: #333; font-size: 16px;">${memory.emotion} ${memory.title}</h4>
              ${privacyBadge}
            </div>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px; line-height: 1.4;">${memory.description || '暂无描述'}</p>
            ${imageGallery}
            <div style="font-size: 12px; color: #999; margin-bottom: 10px;">
              <span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">${memory.theme}</span>
              <span style="color: #666;">${new Date(memory.date).toLocaleDateString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; gap: 6px;">
                <button onclick="showMemoryDetail(${memory.id})" style="background: #3B82F6; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">查看详情</button>
                <button onclick="centerToMemory(${memory.longitude}, ${memory.latitude})" style="background: #10B981; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">居中显示</button>
              </div>
              <button onclick="toggleLike(${memory.id})" class="like-button ${memory.liked ? 'liked' : ''}" style="background: none; border: none; cursor: pointer; color: ${memory.liked ? '#ef4444' : '#6b7280'}; display: flex; align-items: center; gap: 2px; font-size: 12px;">
                ${memory.liked ? '❤️' : '🤍'} ${memory.likeCount}
              </button>
            </div>
          </div>
        `;
        
        const infoWindow = new BMap.InfoWindow(infoContent, {
          width: 280,
          height: currentViewMode === 'all' ? 220 : 200
        });
        
        marker.addEventListener("click", function() {
          map.openInfoWindow(infoWindow, marker.getPosition());
        });
      });

      updateCounters();
      console.log(`成功显示了 ${currentMarkers.length} 个地图标记`);
      
      if (memories.length > 0 && map.getZoom() < 8) {
        setTimeout(() => {
          showNotification('💡 提示：缩放地图可以更清楚地看到记忆点标记', 'info');
        }, 1000);
      }
    }

    function centerToMemory(lng, lat) {
      const point = new BMap.Point(lng, lat);
      map.centerAndZoom(point, 15);
      showNotification('🎯 已居中到该记忆点', 'info');
    }

    function centerMap() {
      const chinaCenter = new BMap.Point(104.1954, 35.8617);
      map.centerAndZoom(chinaCenter, 5);
      showNotification('已返回地图中心', 'info');
    }

    function applyFilters() {
      const selectedTheme = document.getElementById('filter-theme').value;
      const selectedEmotions = [];
      document.querySelectorAll('.filter-emotion-btn.bg-blue-200').forEach(btn => {
        selectedEmotions.push(btn.getAttribute('data-emotion'));
      });
      const startDate = document.getElementById('filter-start-date').value;
      const endDate = document.getElementById('filter-end-date').value;

      let filtered = [...allMemories];

      if (selectedTheme) {
        filtered = filtered.filter(m => m.theme === selectedTheme);
      }

      if (selectedEmotions.length > 0) {
        filtered = filtered.filter(m => selectedEmotions.includes(m.emotion));
      }

      if (startDate) {
        filtered = filtered.filter(m => m.date >= startDate);
      }

      if (endDate) {
        filtered = filtered.filter(m => m.date <= endDate);
      }

      filteredMemories = filtered;
      displayMemories(filtered);
      
      showNotification(`筛选完成，显示 ${filtered.length} 个记忆点`, 'info');
    }

    function clearFilters() {
      document.getElementById('filter-theme').value = '';
      document.getElementById('filter-start-date').value = '';
      document.getElementById('filter-end-date').value = '';
      document.querySelectorAll('.filter-emotion-btn').forEach(btn => {
        btn.classList.remove('bg-blue-200', 'border-blue-500');
      });

      filteredMemories = allMemories;
      displayMemories(allMemories);
      showNotification('已清除所有筛选条件', 'info');
    }

    function updateCounters() {
      document.getElementById('totalMemoriesCount').textContent = allMemories.length;
      document.getElementById('displayedMemoriesCount').textContent = filteredMemories.length;
    }

    // ========== 实时点赞功能 ==========
    async function toggleLike(memoryId) {
      try {
        const result = await apiClient.toggleLike(memoryId);
        if (result.success) {
          updateLikeButtonUI(memoryId, {
            liked: result.liked,
            likeCount: result.likeCount
          });
          
          const memory = allMemories.find(m => m.id === memoryId);
          if (memory) {
            memory.liked = result.liked;
            memory.likeCount = result.likeCount;
          }
          
          const action = result.liked ? '点赞' : '取消点赞';
          showNotification(`${action}成功！`, 'success');
        } else {
          showNotification(result.message, 'error');
        }
      } catch (error) {
        console.error('点赞操作失败:', error);
        showNotification('点赞操作失败：' + error.message, 'error');
      }
    }

    // ========== 图片预览功能 ==========
    function openImageModal(imageSrc) {
      const modal = document.getElementById('imageModal');
      const modalImage = document.getElementById('modalImage');
      modalImage.src = imageSrc;
      modal.classList.remove('hidden');
    }

    function closeImageModal() {
      document.getElementById('imageModal').classList.add('hidden');
    }

    // 记忆详情相关函数
    function showMemoryDetail(memoryId) {
      const memory = allMemories.find(m => m.id === memoryId);
      if (!memory) return;

      currentMemoryId = memoryId;

      const isOwner = currentUser && memory.username === currentUser.username;
      
      const privacyBadge = memory.privacy === 'private' ? 
        '<span class="privacy-badge privacy-private">🔒 私密</span>' : 
        '<span class="privacy-badge privacy-public">🌍 公开</span>';

      const imageGallery = memory.images && memory.images.length > 0 ? 
        `<div>
          <span class="text-sm text-gray-600">记忆图片：</span>
          <div class="detail-image-gallery">
            ${memory.images.map(img => 
              `<img src="${img}" onclick="openImageModal('${img}')">`
            ).join('')}
          </div>
        </div>` : '';

      const content = `
        <div class="space-y-4">
          <div class="text-center">
            <div style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 8px;">
              <h4 class="font-semibold text-xl text-gray-800">${memory.emotion} ${memory.title}</h4>
              ${privacyBadge}
            </div>
            <button onclick="toggleLike(${memory.id})" class="like-button ${memory.liked ? 'liked' : ''}" style="font-size: 18px;">
              ${memory.liked ? '❤️' : '🤍'} ${memory.likeCount} 个赞
            </button>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-600">创建者：</span>
              <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">👤 ${memory.username}</span>
            </div>
            <div>
              <span class="text-gray-600">主题：</span>
              <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">${memory.theme}</span>
            </div>
            <div>
              <span class="text-gray-600">日期：</span>
              <span>${new Date(memory.date).toLocaleDateString()}</span>
            </div>
            <div>
              <span class="text-gray-600">心情：</span>
              <span>${memory.emotion}</span>
            </div>
          </div>
          <div>
            <span class="text-sm text-gray-600">位置坐标：</span>
            <div class="text-sm bg-gray-50 p-2 rounded mt-1">
              经度: ${memory.longitude.toFixed(6)}°<br>
              纬度: ${memory.latitude.toFixed(6)}°
            </div>
          </div>
          ${imageGallery}
          <div>
            <span class="text-sm text-gray-600">记忆描述：</span>
            <p class="text-sm mt-1 p-3 bg-gray-50 rounded leading-relaxed">${memory.description || '暂无描述'}</p>
          </div>
          <div class="text-xs text-gray-500 border-t pt-2">
            <div>创建时间：${new Date(memory.createdAt).toLocaleString()}</div>
          </div>
        </div>
      `;

      document.getElementById('memoryDetailContent').innerHTML = content;
      
      const actionsDiv = document.getElementById('memoryDetailActions');
      if (isOwner) {
        actionsDiv.style.display = 'flex';
      } else {
        actionsDiv.style.display = 'none';
      }
      
      document.getElementById('memoryDetailModal').classList.remove('hidden');
    }

    function hideMemoryDetail() {
      document.getElementById('memoryDetailModal').classList.add('hidden');
      currentMemoryId = null;
    }

    async function deleteMemory() {
      if (!currentMemoryId) return;
      
      const memory = allMemories.find(m => m.id === currentMemoryId);
      if (confirm(`确定要删除记忆"${memory.title}"吗？此操作无法撤销。`)) {
        try {
          const result = await apiClient.deleteMemory(currentMemoryId);
          if (result.success) {
            showNotification('记忆点已删除', 'success');
            hideMemoryDetail();
            if (currentViewMode === 'all') {
              await loadAllMemories();
            } else {
              await loadMyMemories();
            }
          } else {
            showNotification('删除失败：' + result.message, 'error');
          }
        } catch (error) {
          console.error('删除失败:', error);
          showNotification('删除失败：' + error.message, 'error');
        }
      }
    }

    // ========== 用户定位功能（传统API版本） ==========
    function locateUser() {
      const locateBtn = document.getElementById('locateBtn');
      const originalHTML = locateBtn.innerHTML;
      
      locateBtn.innerHTML = '<span>⏳</span><span>定位中...</span>';
      locateBtn.disabled = true;
      locateBtn.classList.add('opacity-75');

      const geolocation = new BMap.Geolocation();
      
      geolocation.getCurrentPosition(function(result) {
        if (this.getStatus() == BMAP_STATUS_SUCCESS) {
          const point = new BMap.Point(result.point.lng, result.point.lat);
          map.centerAndZoom(point, 15);
          
          if (userLocationMarker) {
            map.removeOverlay(userLocationMarker);
          }
          
          const locationIcon = new BMap.Icon(
            'data:image/svg+xml;base64,' + btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="#FF4444" stroke="#FFFFFF" stroke-width="3"/>
                <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
                <circle cx="16" cy="16" r="3" fill="#FF4444"/>
              </svg>
            `), 
            new BMap.Size(32, 32),
            {
              anchor: new BMap.Size(16, 16)
            }
          );
          
          userLocationMarker = new BMap.Marker(point, { icon: locationIcon });
          map.addOverlay(userLocationMarker);
          
          const infoWindow = new BMap.InfoWindow(`
            <div style="padding: 8px; text-align: center; font-family: Arial, sans-serif;">
              <div style="font-weight: bold; color: #FF4444; font-size: 16px; margin-bottom: 6px;">
                📍 您的当前位置
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                经度: ${result.point.lng.toFixed(6)}°<br>
                纬度: ${result.point.lat.toFixed(6)}°
              </div>
              <div style="font-size: 11px; color: #888;">
                精度: ${result.accuracy || '未知'} 米
              </div>
            </div>
          `, {
            width: 200,
            height: 120
          });
          
          userLocationMarker.addEventListener("click", function() {
            map.openInfoWindow(infoWindow, point);
          });
          
          setTimeout(() => {
            map.openInfoWindow(infoWindow, point);
          }, 500);
          
          showNotification('🎯 定位成功！红色标记为您的当前位置', 'success');
        } else {
          showNotification('定位失败，请检查定位权限设置', 'error');
        }
        
        locateBtn.innerHTML = originalHTML;
        locateBtn.disabled = false;
        locateBtn.classList.remove('opacity-75');
      }, {
        enableHighAccuracy: true
      });

      setTimeout(() => {
        if (locateBtn.disabled) {
          showNotification('定位超时，请重试', 'warning');
          locateBtn.innerHTML = originalHTML;
          locateBtn.disabled = false;
          locateBtn.classList.remove('opacity-75');
        }
      }, 12000);
    }

    // ========== 加载记忆函数 ==========
    async function loadAllMemories() {
      try {
        showNotification('正在加载记忆数据...', 'info');
        const result = await apiClient.getMemories('all');
        if (result.success) {
          allMemories = result.memories;
          filteredMemories = result.memories;
          currentViewMode = 'all';
          document.getElementById('currentPageType').textContent = '全部记忆';
          displayMemories(result.memories);
          updateCounters();
          console.log(`加载了 ${result.memories.length} 个记忆点（所有可见）`);
        } else {
          showNotification('加载记忆失败：' + result.message, 'error');
        }
      } catch (error) {
        console.error('加载记忆点失败:', error);
        showNotification('加载记忆点失败：' + error.message, 'error');
      }
    }

    async function loadMyMemories() {
      try {
        showNotification('正在加载我的记忆...', 'info');
        const result = await apiClient.getMemories('my');
        if (result.success) {
          allMemories = result.memories;
          filteredMemories = result.memories;
          currentViewMode = 'my';
          document.getElementById('currentPageType').textContent = '我的记忆';
          displayMemories(result.memories);
          updateCounters();
          console.log(`加载了 ${result.memories.length} 个记忆点（当前用户）`);
        } else {
          showNotification('加载记忆失败：' + result.message, 'error');
        }
      } catch (error) {
        console.error('加载记忆点失败:', error);
        showNotification('加载记忆点失败：' + error.message, 'error');
      }
    }

    function setupFilterEmotionButtons() {
      document.querySelectorAll('.filter-emotion-btn').forEach(btn => {
        btn.onclick = function () {
          this.classList.toggle('bg-blue-200');
          this.classList.toggle('border-blue-500');
        };
      });
    }

    // ========== 应用启动 ==========
    window.onload = async function() {
      // 检查token是否有效
      if (apiClient.token) {
        try {
          const result = await apiClient.getUserProfile();
          if (result.success) {
            currentUser = result.user;
            document.getElementById('currentUser').textContent = `欢迎，${result.user.username}`;
            document.getElementById('sidebarCurrentUser').textContent = result.user.username;
            showMainApp();
            showNotification(`自动登录成功，欢迎回来 ${result.user.username}！`, 'success');
          } else {
            // Token无效，清除并显示登录页
            apiClient.logout();
            showAuthPage();
          }
        } catch (error) {
          console.error('验证登录状态失败:', error);
          apiClient.logout();
          showAuthPage();
        }
      } else {
        showAuthPage();
        setTimeout(() => {
          showNotification('💡 欢迎使用城市记忆平台传统地图版本，请注册账号开始记录您的美好回忆！', 'info');
        }, 2000);
      }

      document.getElementById('imageModal').addEventListener('click', function(e) {
        if (e.target === this) {
          closeImageModal();
        }
      });
    };

    // ========== 调试事件监听器 ==========
    document.addEventListener('emotionSelected', function(e) {
      console.log('情绪选择事件触发:', e.detail);
    });