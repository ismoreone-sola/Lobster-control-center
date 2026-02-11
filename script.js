// 配置
let config = {
  gatewayWs: 'ws://127.0.0.1:18789',
  refreshInterval: 5000
};

// WebSocket 連接
let ws = null;
let isConnected = false;
let startTime = Date.now();
let activityLog = [];

// Chart.js 配置
let performanceChart = null;
let chartData = {
  labels: [],
  cpu: [],
  memory: [],
  tokens: []
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initializeWebSocket();
  initializeChart();
  updateUptime();
  setInterval(updateUptime, 1000);
  setInterval(updateChart, 5000);
});

// 初始化 WebSocket
function initializeWebSocket() {
  fetch('/api/config')
    .then(response => response.json())
    .then(data => {
      config.gatewayWs = data.gatewayWs;
      connectWebSocket();
    })
    .catch(error => {
      console.error('Failed to fetch config:', error);
      connectWebSocket();
    });
}

// 建立 WebSocket 連接
function connectWebSocket() {
  let reconnectDelay = 1000;
  const maxReconnectDelay = 30000;
  
  function attemptConnection() {
    ws = new WebSocket(config.gatewayWs);
    
    ws.onopen = () => {
      isConnected = true;
      reconnectDelay = 1000; // 重置延遲
      updateStatusIndicator('connected');
      addActivityLog('🦞', '已連接到 OpenClaw Gateway', 'success');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      isConnected = false;
      updateStatusIndicator('disconnected');
      addActivityLog('⚠️', `WebSocket 連接已斷開，${reconnectDelay/1000}秒後嘗試重連...`, 'warning');
      
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
        attemptConnection();
      }, reconnectDelay);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateStatusIndicator('error');
    };
  }

  attemptConnection();
}

// 處理 WebSocket 訊息
function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'lock_status':
      updateLockStatus(data.locks);
      break;
      
    case 'heartbeat':
      addActivityLog('💓', `心跳檢查 - 耗時: ${data.duration}ms`, 'info');
      break;
      
    case 'session_status':
      addActivityLog('📊', `會話狀態更新 - 模型: ${data.model}`, 'info');
      updateMemoryUsage(data.contextUsage);
      break;
      
    case 'agent_turn':
      addActivityLog('🤖', `子代理啟動 - ${data.agentId || 'main'}`, 'info');
      updateSubAgentsCount(data.count || 1);
      break;
      
    case 'cron_job':
      addActivityLog('⏰', `Cron 任務 - ${data.jobName}`, 'info');
      break;
      
    case 'web_search':
      addActivityLog('🔍', `網路搜索 - ${data.query}`, 'info');
      break;
      
    case 'system_event':
      addActivityLog('🔔', `系統事件 - ${data.message}`, 'info');
      break;
      
    default:
      addActivityLog('📡', `未知訊息類型: ${data.type}`, 'info');
  }
}

// 更新狀態指示器
function updateStatusIndicator(status) {
  const indicator = document.getElementById('status-indicator');
  const statusText = indicator.querySelector('span:last-child');
  const statusDot = indicator.querySelector('.bg-yellow-500');
  
  switch (status) {
    case 'connected':
      statusDot.className = 'relative inline-flex rounded-full h-3 w-3 bg-green-500';
      statusText.textContent = '已連線';
      break;
      
    case 'disconnected':
      statusDot.className = 'relative inline-flex rounded-full h-3 w-3 bg-red-500';
      statusText.textContent = '已斷線';
      break;
      
    case 'error':
      statusDot.className = 'relative inline-flex rounded-full h-3 w-3 bg-red-500';
      statusText.textContent = '錯誤';
      break;
      
    default:
      statusDot.className = 'relative inline-flex rounded-full h-3 w-3 bg-yellow-500';
      statusText.textContent = '連線中...';
  }
}

// 添加活動日誌
function addActivityLog(icon, message, type = 'info') {
  const logContainer = document.getElementById('activity-log');
  const timestamp = new Date().toLocaleTimeString('zh-TW');
  
  const logItem = document.createElement('div');
  logItem.className = `activity-item flex items-start gap-2 text-sm`;
  
  let colorClass = 'text-slate-400';
  switch (type) {
    case 'success':
      colorClass = 'text-green-400';
      break;
    case 'warning':
      colorClass = 'text-yellow-400';
      break;
    case 'error':
      colorClass = 'text-red-400';
      break;
  }
  
  logItem.innerHTML = `
    <span class="text-slate-500 mt-1">[${timestamp}]</span>
    <span class="${colorClass}">${icon}</span>
    <span class="${colorClass}">${message}</span>
  `;
  
  // 移除等待訊息
  const waitingMessage = logContainer.querySelector('.text-slate-500.italic');
  if (waitingMessage) {
    waitingMessage.remove();
  }
  
  logContainer.appendChild(logItem);
  logContainer.scrollTop = logContainer.scrollHeight;
  
  // 限制日誌條目數量
  if (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.firstChild);
  }
}

// 更新運行時間
function updateUptime() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  
  const uptimeElement = document.getElementById('uptime');
  uptimeElement.textContent = `${hours}h ${minutes}m ${seconds}s`;
}

// 更新記憶體使用率
function updateMemoryUsage(usage) {
  const memoryBar = document.getElementById('memory-bar');
  const memoryText = document.getElementById('memory-text');
  
  const percentage = Math.round((usage / 131000) * 100); // 131k 是總限制
  memoryBar.style.width = `${percentage}%`;
  memoryText.textContent = `${percentage}%`;
  
  // 根據使用率改變顏色
  if (percentage > 80) {
    memoryBar.className = 'bg-red-500 h-full transition-all duration-300';
  } else if (percentage > 60) {
    memoryBar.className = 'bg-yellow-500 h-full transition-all duration-300';
  } else {
    memoryBar.className = 'bg-teal-500 h-full transition-all duration-300';
  }
}

// 更新子代理計數
function updateSubAgentsCount(count) {
  const subAgentsElement = document.getElementById('sub-agents-count');
  subAgentsElement.textContent = count;
}

// 更新鎖狀態監控
function updateLockStatus(locks) {
  const container = document.getElementById('lock-status-monitor');
  if (!container) return;
  
  if (!locks || locks.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-500 italic">目前無活躍鎖</div>';
    return;
  }
  
  container.innerHTML = locks.map(lock => `
    <div class="flex items-center justify-between p-2 rounded bg-slate-700/50 mb-1 border-l-2 ${lock.status === 'locked' ? 'border-red-500' : 'border-green-500'}">
      <div class="flex flex-col">
        <span class="text-xs font-bold text-slate-200">${lock.resource}</span>
        <span class="text-[10px] text-slate-400">持有者: ${lock.owner}</span>
      </div>
      <span class="text-[10px] px-1 rounded ${lock.status === 'locked' ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}">
        ${lock.status === 'locked' ? '已鎖定' : '已釋放'}
      </span>
    </div>
  `).join('');
}

// 初始化圖表
function initializeChart() {
  const ctx = document.getElementById('performance-chart').getContext('2d');
  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'CPU 使用率 (%)',
        data: [],
        borderColor: 'rgb(20, 184, 166)',
        backgroundColor: 'rgba(20, 184, 166, 0.1)',
        tension: 0.4
      }, {
        label: '記憶體使用率 (%)',
        data: [],
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4
      }, {
        label: 'Token 使用率 (%)',
        data: [],
        borderColor: 'rgb(251, 191, 36)',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: '#94a3b8'
          },
          grid: {
            color: '#334155'
          }
        },
        x: {
          ticks: {
            color: '#94a3b8'
          },
          grid: {
            color: '#334155'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#e2e8f0'
          }
        }
      }
    }
  });
}

// 更新圖表
function updateChart() {
  if (!performanceChart) return;
  
  const now = new Date().toLocaleTimeString('zh-TW', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  // 模擬數據
  const cpuUsage = Math.random() * 100;
  const memoryUsage = Math.round((Math.random() * 50 + 10)); // 10-60%
  const tokenUsage = Math.round((Math.random() * 30 + 5)); // 5-35%
  
  // 添加新數據
  chartData.labels.push(now);
  chartData.cpu.push(cpuUsage);
  chartData.memory.push(memoryUsage);
  chartData.tokens.push(tokenUsage);
  
  // 保持最多20個數據點
  if (chartData.labels.length > 20) {
    chartData.labels.shift();
    chartData.cpu.shift();
    chartData.memory.shift();
    chartData.tokens.shift();
  }
  
  // 更新圖表
  performanceChart.data.labels = chartData.labels;
  performanceChart.data.datasets[0].data = chartData.cpu;
  performanceChart.data.datasets[1].data = chartData.memory;
  performanceChart.data.datasets[2].data = chartData.tokens;
  performanceChart.update();
}