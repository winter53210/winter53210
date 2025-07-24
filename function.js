// 在文件顶部添加倍速相关变量
let timelineMap, playInterval, timelineData = [], timelineIndex = 0;
let playbackSpeed = 1; // 新增：播放倍速
let basePlaybackInterval = 600; // 新增：基础播放间隔（毫秒）

// ========= 增强的导航函数 =========
async function showView(view) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-blue-600', 'font-medium');
    btn.classList.add('hover:text-blue-600');
  });
  
  event.target.classList.add('text-blue-600', 'font-medium');
  event.target.classList.remove('hover:text-blue-600');

  document.getElementById('visualizationViews')?.classList.add('hidden');
  ['heatmapContainer', 'wordcloudContainer', 'timelineContainer', 'rankingListContainer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // 获取地图控制面板元素
  const mapControls = document.querySelector('.map-controls');

  switch(view) {
    case 'home':
      // 显示地图控制面板
      if (mapControls) mapControls.style.display = 'block';
      await loadAllMemories();
      showNotification('显示所有可见的记忆点', 'info');
      break;
      
    case 'mymemories':
      // 显示地图控制面板
      if (mapControls) mapControls.style.display = 'block';
      await loadMyMemories();
      showNotification('显示您的记忆点', 'info');
      break;
      
    case 'heatmap':
      // 隐藏地图控制面板
      if (mapControls) mapControls.style.display = 'none';
      document.getElementById('visualizationViews').classList.remove('hidden');
      document.getElementById('heatmapContainer').classList.remove('hidden');
      renderHeatmap();
      break;
      
    case 'wordcloud':
      // 隐藏地图控制面板
      if (mapControls) mapControls.style.display = 'none';
      document.getElementById('visualizationViews').classList.remove('hidden');
      document.getElementById('wordcloudContainer').classList.remove('hidden');
      renderWordCloud();
      break;
      
    case 'timeline':
      // 隐藏地图控制面板
      if (mapControls) mapControls.style.display = 'none';
      document.getElementById('visualizationViews').classList.remove('hidden');
      document.getElementById('timelineContainer').classList.remove('hidden');
      initTimelineMap();
      playTimeline();
      break;
      
    case 'rankinglist':
      // 隐藏地图控制面板
      if (mapControls) mapControls.style.display = 'none';
      document.getElementById('visualizationViews').classList.remove('hidden');
      document.getElementById('rankingListContainer').classList.remove('hidden');
      renderRankingList();
      break;
  }
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

// ========= 增强的热力图函数 =========
function renderHeatmap() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    showNotification('未登录，无法加载热力图', 'warning');
    return;
  }

  // 初始化热力图地图
  if (!window.heatmap) {
    // 创建地图时禁用默认缩放控件
    window.heatmap = L.map('heatmapMap', {
      zoomControl: false
    }).setView([35.8617, 104.1954], 4);

    // 添加底图图层
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(window.heatmap);

    // 添加缩放控件到右上角
    L.control.zoom({ position: 'topright' }).addTo(window.heatmap);
  }

  // 首先清除之前的所有热力图图层
  window.heatmap.eachLayer(layer => {
    if (layer instanceof L.HeatLayer) {
      window.heatmap.removeLayer(layer);
    }
  });

  // 使用当前筛选后的数据
  const memoriesToUse = filteredMemories;
  
  if (memoriesToUse.length === 0) {
    // 当没有数据时，显示提示信息
    showNotification('当前筛选条件下没有数据，热力图已清空', 'warning');
    return;
  }

  // 生成热力图数据点
  const points = memoriesToUse.map(m => [m.latitude, m.longitude, 0.8]);
  
  // 添加新的热力图图层
  const heatLayer = L.heatLayer(points, {
    radius: 30,
    blur: 20,
    minOpacity: 0.3,
    gradient: {
      0.2: '#3366cc',
      0.4: '#3399ff',
      0.6: '#ff9900',
      0.8: '#ff3300',
      1.0: '#990000'
    }
  }).addTo(window.heatmap);

  // 显示筛选信息
  const totalCount = allMemories.length;
  const filteredCount = memoriesToUse.length;
  
  let filterMessage;
  if (totalCount === 0) {
    filterMessage = '暂无记忆数据';
  } else if (filteredCount === totalCount) {
    filterMessage = `热力图已生成，显示所有 ${totalCount} 个记忆点`;
  } else {
    filterMessage = `热力图已生成，显示筛选后的 ${filteredCount}/${totalCount} 个记忆点`;
  }
  
  showNotification(filterMessage, 'success');

  // 自动调整地图视图以适应数据点
  if (points.length > 0) {
    const group = new L.featureGroup(points.map(p => L.marker([p[0], p[1]])));
    window.heatmap.fitBounds(group.getBounds().pad(0.1));
  }
}

// ========= 修改筛选应用函数 =========
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
  
  // 根据当前视图更新显示
  const currentView = getCurrentView();
  if (currentView === 'heatmap') {
    // 如果当前在热力图视图，重新渲染热力图
    renderHeatmap();
  } else {
    // 如果在地图视图，显示筛选后的标记
    displayMemories(filtered);
  }
  
  // 显示筛选结果消息
  let filterMessage;
  if (filtered.length === 0) {
    filterMessage = '当前筛选条件下没有匹配的记忆点';
  } else if (filtered.length === allMemories.length) {
    filterMessage = `显示所有 ${filtered.length} 个记忆点`;
  } else {
    filterMessage = `筛选完成，显示 ${filtered.length}/${allMemories.length} 个记忆点`;
  }
  
  showNotification(filterMessage, filtered.length === 0 ? 'warning' : 'info');
}

// ========= 修改清除筛选函数 =========
function clearFilters() {
  document.getElementById('filter-theme').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  document.querySelectorAll('.filter-emotion-btn').forEach(btn => {
    btn.classList.remove('bg-blue-200', 'border-blue-500');
  });

  filteredMemories = allMemories;
  
  // 根据当前视图更新显示
  const currentView = getCurrentView();
  if (currentView === 'heatmap') {
    // 如果当前在热力图视图，重新渲染热力图
    renderHeatmap();
  } else {
    // 如果在地图视图，显示所有标记
    displayMemories(allMemories);
  }
  
  showNotification('已清除所有筛选条件，显示全部记忆点', 'info');
}

// ========= 获取当前视图的辅助函数 =========
function getCurrentView() {
  // 检查哪个视图容器是可见的
  const visualizationViews = document.getElementById('visualizationViews');
  if (visualizationViews && !visualizationViews.classList.contains('hidden')) {
    if (!document.getElementById('heatmapContainer').classList.contains('hidden')) {
      return 'heatmap';
    }
    if (!document.getElementById('wordcloudContainer').classList.contains('hidden')) {
      return 'wordcloud';
    }
    if (!document.getElementById('timelineContainer').classList.contains('hidden')) {
      return 'timeline';
    }
  }
  return 'map'; // 默认为地图视图
}



// ========= 热力图增强功能 =========
function addHeatmapControls() {
  // 为热力图添加额外的控制面板
  const heatmapContainer = document.getElementById('heatmapContainer');
  if (heatmapContainer && !heatmapContainer.querySelector('.heatmap-controls')) {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'heatmap-controls';
    controlsDiv.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background: white;
      padding: 10px;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    controlsDiv.innerHTML = `
      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
        热力图控制
      </div>
      <button onclick="refreshHeatmap()" style="
        background: #3B82F6; 
        color: white; 
        border: none; 
        padding: 6px 12px; 
        border-radius: 4px; 
        font-size: 12px; 
        cursor: pointer;
        margin-right: 4px;
      ">
        🔄 刷新
      </button>
      <button onclick="resetHeatmapView()" style="
        background: #10B981; 
        color: white; 
        border: none; 
        padding: 6px 12px; 
        border-radius: 4px; 
        font-size: 12px; 
        cursor: pointer;
      ">
        🌍 重置视图
      </button>
    `;
    
    heatmapContainer.appendChild(controlsDiv);
  }
}

// ========= 热力图辅助函数 =========
function refreshHeatmap() {
  showNotification('正在刷新热力图...', 'info');
  renderHeatmap();
}

function resetHeatmapView() {
  if (window.heatmap) {
    window.heatmap.setView([35.8617, 104.1954], 4);
    showNotification('热力图视图已重置', 'info');
  }
}

// ========= 在热力图显示时自动添加控制面板 =========
// 修改原有的 renderHeatmap 函数，在最后添加控制面板
function renderHeatmapWithControls() {
  renderHeatmap();
  setTimeout(() => {
    addHeatmapControls();
  }, 100);
}


// ========= 关键词云 =========
function renderWordCloud() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    showNotification('未登录，无法加载词云', 'warning');
    return;
  }

  fetch('/api/memories', {
    headers: { Authorization: 'Bearer ' + token }
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success || !data.memories.length) {
        showNotification('暂无数据生成词云', 'info');
        return;
      }

      // 1. 更精细的文本处理
      const freq = {};
      const memoriesWithDesc = data.memories.filter(m => 
        m.description && m.description.trim().length > 0
      );

      memoriesWithDesc.forEach(m => {
        // 更好的中文分词处理
        const words = m.description.match(/[\u4e00-\u9fa5]{2,}/g) || [];
        words.forEach(w => {
          // 过滤无意义词汇
          const stopWords = ['这个','那个','还有','一些','时候','可以','觉得','没有','什么'];
          if (!stopWords.includes(w)) {
            freq[w] = (freq[w] || 0) + 1;
          }
        });
      });

      // 2. 按词频排序并限制数量
      const sortedWords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 80); // 限制词数使布局更美观

      if (!sortedWords.length) {
        showNotification('没有足够的关键词生成词云', 'info');
        return;
      }

      // 3. 创建词频映射表，确保获取原始整数词频
      const wordFreqMap = {};
      sortedWords.forEach(([word, count]) => {
        wordFreqMap[word] = parseInt(count); // 确保是整数
      });

      // 4. 创建容器和画布
      const container = document.getElementById('wordcloudContainer');
      container.innerHTML = `
        <div class="wordcloud-wrapper">
          <canvas id="wordCloudCanvas"></canvas>
          <div class="wordcloud-controls">
            <button class="zoom-in">🔍+</button>
            <button class="zoom-out">🔍-</button>
            <button class="reset-view">↻ 重置</button>
          </div>
        </div>
      `;
      
      const canvas = document.getElementById('wordCloudCanvas');
      const wrapper = container.querySelector('.wordcloud-wrapper');
      
      // 5. 设置基础尺寸（更大的画布提高清晰度）
      const baseWidth = 1600;
      const baseHeight = 1200;
      canvas.width = baseWidth;
      canvas.height = baseHeight;
      
      // 6. 美观的颜色方案（多种可选）
      const colorSchemes = {
        vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F06292', '#7986CB', '#9575CD'],
        pastel: ['#A5D6A7', '#81D4FA', '#B39DDB', '#FFAB91', '#CE93D8', '#9FA8DA', '#80CBC4', '#FFCC80'],
        warm: ['#FF7043', '#FFA726', '#FFEE58', '#8BC34A', '#26C6DA', '#42A5F5', '#7E57C2', '#EC407A'],
        cool: ['#5C6BC0', '#26A69A', '#AB47BC', '#66BB6A', '#29B6F6', '#EF5350', '#FFA726', '#26C6DA']
      };
      
      // 7. 高级渲染配置
      const renderCloud = (scale = 1) => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        WordCloud(canvas, {
          list: sortedWords,
          gridSize: Math.round(12 * (1/scale)), // 动态调整网格大小
          weightFactor: size => Math.pow(size, 1.2) * 30 * scale, // 非线性放大
          fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif', // 更好看的中文字体
          color: () => {
            const colors = colorSchemes.vibrant; // 可切换配色方案
            return colors[Math.floor(Math.random() * colors.length)];
          },
          backgroundColor: '#FFFFFF',
          minSize: 8, // 最小字体
          rotateRatio: 0.4, // 旋转词的比例
          rotationSteps: 3, // 旋转角度分级
          minRotation: -30, // 最小旋转角度
          maxRotation: 30,  // 最大旋转角度
          drawOutOfBound: false,
          shrinkToFit: true,
          shape: 'circle', // 可选: circle, cardioid, diamond, triangle, pentagon, star
          click: (item) => {
            // 修复：使用原始词频映射表获取准确的整数词频
            const word = item[0];
            const realCount = wordFreqMap[word] || 0;
            showNotification(`关键词 "${word}" 出现 ${realCount} 次`, 'info');
            
            // 可选：添加更详细的信息
            console.log(`点击了关键词: ${word}, 原始词频: ${realCount}, WordCloud传递的值: ${item[1]}`);
          }
        });
      };

      // 8. 交互控制
      let scale = 1;
      let posX = 0;
      let posY = 0;
      let isDragging = false;
      let startX, startY;

      // 缩放控制按钮
      container.querySelector('.zoom-in').addEventListener('click', () => {
        scale = Math.min(3, scale + 0.2);
        renderCloud(scale);
        updateTransform();
      });
      
      container.querySelector('.zoom-out').addEventListener('click', () => {
        scale = Math.max(0.5, scale - 0.2);
        renderCloud(scale);
        updateTransform();
      });
      
      container.querySelector('.reset-view').addEventListener('click', () => {
        scale = 1;
        posX = 0;
        posY = 0;
        renderCloud(scale);
        updateTransform();
      });

      // 鼠标交互
      wrapper.addEventListener('wheel', function(e) {
        e.preventDefault();
        const zoomFactor = 0.1;
        const rect = wrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const oldScale = scale;
        scale = e.deltaY < 0 
          ? Math.min(3, scale + zoomFactor) 
          : Math.max(0.5, scale - zoomFactor);
        
        if (Math.abs(oldScale - scale) > 0.3) {
          renderCloud(scale);
        }
        
        posX = mouseX - (mouseX - posX) * (scale / oldScale);
        posY = mouseY - (mouseY - posY) * (scale / oldScale);
        updateTransform();
      });

      wrapper.addEventListener('mousedown', function(e) {
        if (scale > 1) {
          isDragging = true;
          startX = e.clientX - posX;
          startY = e.clientY - posY;
          wrapper.style.cursor = 'grabbing';
        }
      });

      document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        posX = e.clientX - startX;
        posY = e.clientY - startY;
        updateTransform();
      });

      document.addEventListener('mouseup', function() {
        isDragging = false;
        wrapper.style.cursor = scale > 1 ? 'grab' : 'default';
      });

      function updateTransform() {
        wrapper.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        wrapper.style.cursor = scale > 1 ? 'grab' : 'default';
      }

      // 初始渲染
      renderCloud();
      
      // 添加调试信息
      console.log('词频统计结果:', freq);
      console.log('词频映射表:', wordFreqMap);
    })
    .catch(err => {
      showNotification('关键词云失败：' + err.message, 'error');
    });
}

// ========= 时间回溯 =========
function initTimelineMap() {
  if (!timelineMap) {
    timelineMap = L.map('timelineMap');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(timelineMap);
  }

  // 每次都重设视图为中国区域
  timelineMap.setView([35.8617, 104.1954], 4);
}

let isPaused = true;
let timelineLoaded = false;
function togglePlay() {
  const btn = document.getElementById("playPauseBtn");

  if (!timelineLoaded) {
    // 首次加载数据
    const token = localStorage.getItem('auth_token');
    if (!token) {
      showNotification('未登录，无法播放时间回溯', 'warning');
      return;
    }

    fetch('/api/memories', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(data => {
        timelineData = data.memories
          .filter(m => m.date && m.latitude && m.longitude)
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (timelineData.length === 0) {
          showNotification('暂无可播放的时间点', 'info');
          return;
        }

        timelineLoaded = true;
        timelineIndex = 0;
        document.getElementById('timelineSlider').max = timelineData.length - 1;
        document.getElementById('timelineSlider').value = 0;
        clearMapMarkers();
        startPlayback();
        isPaused = false;
        btn.textContent = "⏸️ 暂停";
      })
      .catch(err => {
        showNotification('加载失败：' + err.message, 'error');
      });
  } else {
    if (isPaused) {
      // 从暂停或播放完继续
      if (timelineIndex >= timelineData.length) {
        timelineIndex = 0;
        document.getElementById('timelineSlider').value = 0;
        clearMapMarkers();
      }
      startPlayback();
      isPaused = false;
      btn.textContent = "⏸️ 暂停";
    } else {
      // 正在播放 → 暂停
      clearInterval(playInterval);
      isPaused = true;
      btn.textContent = "▶️ 播放";
    }
  }
}

function playTimeline() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    showNotification('未登录，无法播放时间回溯', 'warning');
    return;
  }

  if (!timelineLoaded) {
    fetch('/api/memories', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(data => {
        timelineData = data.memories
          .filter(m => m.date && m.latitude && m.longitude)
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (timelineData.length === 0) {
          showNotification('暂无可播放的时间点', 'info');
          return;
        }

        timelineLoaded = true;
        timelineIndex = 0;
        document.getElementById('timelineSlider').max = timelineData.length - 1;
        document.getElementById('timelineSlider').value = timelineIndex;
        startPlayback(); // 从头开始播放
      })
      .catch(err => {
        showNotification('加载时间回溯数据失败：' + err.message, 'error');
      });
  } else {
    startPlayback(); // 数据已加载，继续播放
  }
}
function startPlayback() {
  clearInterval(playInterval);

  playInterval = setInterval(() => {
    if (timelineIndex >= timelineData.length) {
      clearInterval(playInterval);
      isPaused = true;
      document.getElementById('playPauseBtn').textContent = "▶️ 播放";
      return;
    }

    renderTimelinePoint(timelineIndex);
    document.getElementById('timelineSlider').value = timelineIndex;
    timelineIndex++;
  }, 600);
}

function renderTimelinePoint(i) {
  const m = timelineData[i];
  const emojiMap = {
    '开心': '😀', '难过': '😢', '生气': '😡', '喜欢': '❤️',
    '平静': '😐', '兴奋': '🤩'
  };
  const emoji = emojiMap[m.emotion] || '📍';
  const marker = L.marker([m.latitude, m.longitude], {
    icon: L.divIcon({
      className: 'emoji-marker',
      html: `<span style="font-size: 24px;">${emoji}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    })
  }).addTo(timelineMap).bindPopup(m.title);
}

// 滑块控制播放进度
document.getElementById('timelineSlider').addEventListener('input', e => {
  clearInterval(playInterval); // 停止自动播放
  timelineIndex = parseInt(e.target.value);
  // 清除旧图层
  timelineMap.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
      timelineMap.removeLayer(layer);
    }
  });
  renderTimelinePoint(timelineIndex);
});
function stopTimeline() {
  clearInterval(playInterval); // 暂停播放
  showNotification("已停止播放（可继续）", "info");
}
function clearMapMarkers() {
  timelineMap.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
      timelineMap.removeLayer(layer);
    }
  });
}


//记忆排行榜

function renderRankingList() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    showNotification('未登录，无法查看排行榜', 'warning');
    return;
  }

  fetch('/api/memories', {
    headers: { Authorization: 'Bearer ' + token }
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success || !data.memories.length) {
        showNotification('暂无记忆数据用于排行榜', 'info');
        return;
      }

      // 1. 过滤公开的记忆点
      const publicMemories = data.memories.filter(m => m.privacy === 'public');

      // 2. 排序（默认按点赞数降序）
      publicMemories.sort((a, b) => (b.likes || 0) - (a.likes || 0));

      // 3. 渲染列表
      const listContainer = document.getElementById('rankingList');
      listContainer.innerHTML = '';

      publicMemories.forEach((m, index) => {
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        const likes = m.likes || 0;
        const item = document.createElement('div');
        item.className = 'bg-white rounded-lg p-4 shadow hover:shadow-md transition cursor-pointer';
        item.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="text-lg font-semibold">${rankIcon} ${m.title}</div>
            <div class="text-sm text-gray-500">${new Date(m.date).toLocaleDateString()}</div>
          </div>
          <div class="flex justify-between mt-2 text-sm text-gray-600">
            <div>❤️ ${likes} 点赞</div>
            <div>👤 ${m.username || '未知用户'}</div>
          </div>
        `;
        item.addEventListener('click', () => showMemoryDetail(m)); // 点击可查看详情
        listContainer.appendChild(item);
      });
    })
    .catch(err => {
      showNotification('排行榜加载失败：' + err.message, 'error');
    });
}
function showMemoryDetail(memory) {
  const modal = document.getElementById('memoryDetailModal');
  const content = document.getElementById('memoryDetailContent');

  const imagesHtml = (memory.images || [])
    .map(src => `<img src="${src}" class="memory-image" onclick="showImageModal('${src}')">`)
    .join('');

  content.innerHTML = `
    <h3 class="text-xl font-bold mb-2">${memory.title}</h3>
    <p class="text-sm text-gray-500 mb-1">📅 ${new Date(memory.date).toLocaleDateString()}</p>
    <p class="text-sm text-gray-500 mb-1">📌 主题：${memory.theme}</p>
    <p class="text-sm text-gray-500 mb-1">😊 心情：${memory.emotion}</p>
    <p class="text-sm text-gray-500 mb-1">👤 用户：${memory.username || '未知'}</p>
    <p class="mt-2 text-gray-700">${memory.description || '（无描述）'}</p>
    <div class="image-gallery mt-4">${imagesHtml}</div>
  `;

  modal.classList.remove('hidden');
}
