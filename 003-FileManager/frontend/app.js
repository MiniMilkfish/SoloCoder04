class FileManagerApp {
  constructor() {
    this.currentPath = '/';
    this.selectedItems = new Set();
    this.currentFiles = [];
    this.searchQuery = '';
    this.sortBy = 'name';
    this.sortOrder = 'asc';
    this.filterType = 'all';
    this.renameTarget = null;
    this.deleteTargets = [];
    this.moveTargets = [];
    this.moveTargetPath = '/';
    this.uploadQueue = [];
    this.uploadProgressMap = new Map();
    this.previewPath = null;
    
    this.init();
  }
  
  async init() {
    this.checkAuth();
    this.bindEvents();
    
    const token = API.getToken();
    if (token) {
      try {
        const config = await API.getConfig();
        CONFIG.MAX_FILE_SIZE = config.maxFileSize;
        CONFIG.CHUNK_SIZE = config.chunkSize;
      } catch (e) {
        console.error('获取配置失败:', e);
      }
    }
  }
  
  checkAuth() {
    const token = API.getToken();
    const user = API.getUser();
    
    if (token && user) {
      this.showMainPage();
      this.setUserInfo(user);
      this.loadFiles();
    } else {
      this.showLoginPage();
    }
  }
  
  showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('main-page').classList.add('hidden');
  }
  
  showMainPage() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('main-page').classList.remove('hidden');
  }
  
  setUserInfo(user) {
    document.getElementById('user-name').textContent = user.username;
    const roleBadge = document.getElementById('user-role');
    roleBadge.textContent = user.role === 'admin' ? '管理员' : '用户';
    roleBadge.className = `role-badge ${user.role}`;
  }
  
  bindEvents() {
    // 登录表单
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });
    
    // 退出登录
    document.getElementById('logout-btn').addEventListener('click', () => {
      API.clearAuth();
      this.checkAuth();
    });
    
    // 新建文件夹
    document.getElementById('new-folder-btn').addEventListener('click', () => {
      document.getElementById('folder-name').value = '';
      Utils.showModal('new-folder-modal');
      document.getElementById('folder-name').focus();
    });
    
    document.getElementById('create-folder-btn').addEventListener('click', async () => {
      await this.createFolder();
    });
    
    // 上传文件
    document.getElementById('file-upload').addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileUpload(e.target.files);
        e.target.value = '';
      }
    });
    
    // 刷新
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadFiles();
    });
    
    // 搜索
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.searchQuery = e.target.value;
      this.loadFiles();
    }, 300));
    
    // 筛选
    document.getElementById('filter-select').addEventListener('change', (e) => {
      this.filterType = e.target.value;
      this.loadFiles();
    });
    
    // 排序
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.loadFiles();
    });
    
    document.getElementById('order-select').addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.loadFiles();
    });
    
    // 批量操作
    document.getElementById('batch-delete-btn').addEventListener('click', () => {
      this.deleteTargets = Array.from(this.selectedItems);
      const count = this.deleteTargets.length;
      document.getElementById('delete-message').textContent = 
        `确定要删除选中的 ${count} 个文件/文件夹吗？此操作不可撤销。`;
      Utils.showModal('delete-modal');
    });
    
    document.getElementById('batch-move-btn').addEventListener('click', () => {
      this.moveTargets = Array.from(this.selectedItems);
      this.moveTargetPath = '/';
      this.loadMoveFolderList();
      Utils.showModal('move-modal');
    });
    
    document.getElementById('cancel-select-btn').addEventListener('click', () => {
      this.clearSelection();
    });
    
    // 确认删除
    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
      await this.deleteItems();
    });
    
    // 重命名
    document.getElementById('confirm-rename-btn').addEventListener('click', async () => {
      await this.renameItem();
    });
    
    // 移动确认
    document.getElementById('confirm-move-btn').addEventListener('click', async () => {
      await this.moveItems();
    });
    
    // 预览下载
    document.getElementById('preview-download-btn').addEventListener('click', () => {
      if (this.previewPath) {
        window.open(API.getDownloadUrl(this.previewPath), '_blank');
      }
    });
    
    // 模态框关闭
    document.querySelectorAll('.modal-close, .modal .btn-secondary[data-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        Utils.hideModal(modalId);
      });
    });
    
    // 点击模态框背景关闭
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        Utils.hideAllModals();
      }
    });
    
    // 回车确认创建文件夹
    document.getElementById('folder-name').addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        await this.createFolder();
      }
    });
    
    // 回车确认重命名
    document.getElementById('rename-input').addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        await this.renameItem();
      }
    });
  }
  
  async handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    
    if (!username || !password) {
      errorEl.textContent = '请输入用户名和密码';
      errorEl.classList.remove('hidden');
      return;
    }
    
    try {
      const result = await API.login(username, password);
      API.setAuth(result.token, result.user);
      this.showMainPage();
      this.setUserInfo(result.user);
      this.loadFiles();
      errorEl.classList.add('hidden');
    } catch (error) {
      errorEl.textContent = error.message || '登录失败';
      errorEl.classList.remove('hidden');
    }
  }
  
  async loadFiles() {
    this.showLoading();
    this.clearSelection();
    
    try {
      const result = await API.getFiles(
        this.currentPath,
        this.searchQuery,
        this.sortBy,
        this.sortOrder,
        this.filterType
      );
      
      this.currentFiles = result.items;
      this.renderBreadcrumb(result.breadcrumbs);
      this.renderFileList(result.items);
      
      if (result.items.length === 0) {
        this.showEmpty();
      } else {
        this.hideEmpty();
      }
      
      this.currentPath = result.currentPath;
    } catch (error) {
      Utils.showToast(error.message || '加载文件列表失败', 'error');
    } finally {
      this.hideLoading();
    }
  }
  
  renderBreadcrumb(breadcrumbs) {
    const container = document.getElementById('breadcrumb');
    container.innerHTML = breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      return `
        <a href="#" data-path="${crumb.path}" class="breadcrumb-item ${isLast ? 'active' : ''}">
          ${crumb.name}
        </a>
      `;
    }).join('');
    
    container.querySelectorAll('.breadcrumb-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(item.dataset.path);
      });
    });
  }
  
  renderFileList(files) {
    const container = document.getElementById('file-list');
    
    if (files.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = files.map(file => {
      const isSelected = this.selectedItems.has(file.path);
      return `
        <div class="file-item ${isSelected ? 'selected' : ''}" data-path="${file.path}" data-type="${file.type}">
          <div class="checkbox ${isSelected ? 'checked' : ''}"></div>
          <div class="actions">
            <button class="action-btn" data-action="rename" data-path="${file.path}" title="重命名">✏️</button>
            <button class="action-btn" data-action="download" data-path="${file.path}" title="下载">⬇️</button>
            <button class="action-btn" data-action="delete" data-path="${file.path}" title="删除">🗑️</button>
          </div>
          <div class="file-icon">${Utils.getFileIcon(file.type, file.mimeType)}</div>
          <div class="file-name" title="${file.name}">${file.name}</div>
          <div class="file-info">
            ${file.type === 'folder' ? 
              '<span>文件夹</span>' : 
              `<span>${file.sizeFormatted}</span><span>${Utils.formatDate(file.modified)}</span>`
            }
          </div>
        </div>
      `;
    }).join('');
    
    this.bindFileItemEvents();
  }
  
  bindFileItemEvents() {
    const items = document.querySelectorAll('.file-item');
    
    items.forEach(item => {
      const checkbox = item.querySelector('.checkbox');
      
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSelection(item.dataset.path);
      });
      
      item.addEventListener('dblclick', (e) => {
        if (e.target !== checkbox) {
          const path = item.dataset.path;
          const type = item.dataset.type;
          
          if (type === 'folder') {
            this.navigateTo(path);
          } else {
            this.previewFile(path);
          }
        }
      });
      
      item.addEventListener('click', (e) => {
        if (e.target !== checkbox && !e.target.closest('.actions')) {
          if (e.ctrlKey || e.metaKey) {
            this.toggleSelection(item.dataset.path);
          } else if (e.shiftKey) {
            // 暂不实现多选范围
          }
        }
      });
      
      item.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const path = btn.dataset.path;
          
          this.handleAction(action, path);
        });
      });
    });
  }
  
  handleAction(action, path) {
    const file = this.currentFiles.find(f => f.path === path);
    if (!file) return;
    
    switch (action) {
      case 'rename':
        this.renameTarget = path;
        document.getElementById('rename-input').value = file.name;
        Utils.showModal('rename-modal');
        document.getElementById('rename-input').focus();
        document.getElementById('rename-input').select();
        break;
        
      case 'download':
        window.open(API.getDownloadUrl(path), '_blank');
        break;
        
      case 'delete':
        this.deleteTargets = [path];
        document.getElementById('delete-message').textContent = 
          `确定要删除 "${file.name}" 吗？此操作不可撤销。`;
        Utils.showModal('delete-modal');
        break;
    }
  }
  
  toggleSelection(path) {
    if (this.selectedItems.has(path)) {
      this.selectedItems.delete(path);
    } else {
      this.selectedItems.add(path);
    }
    
    this.updateSelectionUI();
  }
  
  clearSelection() {
    this.selectedItems.clear();
    this.updateSelectionUI();
  }
  
  updateSelectionUI() {
    const items = document.querySelectorAll('.file-item');
    items.forEach(item => {
      const path = item.dataset.path;
      const isSelected = this.selectedItems.has(path);
      
      if (isSelected) {
        item.classList.add('selected');
        item.querySelector('.checkbox').classList.add('checked');
      } else {
        item.classList.remove('selected');
        item.querySelector('.checkbox').classList.remove('checked');
      }
    });
    
    const batchToolbar = document.getElementById('batch-toolbar');
    const count = this.selectedItems.size;
    
    if (count > 0) {
      batchToolbar.classList.remove('hidden');
      document.getElementById('selected-count').textContent = count;
    } else {
      batchToolbar.classList.add('hidden');
    }
  }
  
  navigateTo(path) {
    this.currentPath = path;
    this.searchQuery = '';
    document.getElementById('search-input').value = '';
    this.loadFiles();
  }
  
  async createFolder() {
    const name = document.getElementById('folder-name').value.trim();
    
    if (!name) {
      Utils.showToast('请输入文件夹名称', 'warning');
      return;
    }
    
    if (!Utils.isValidFilename(name)) {
      Utils.showToast('文件夹名称包含非法字符', 'warning');
      return;
    }
    
    try {
      await API.createFolder(this.currentPath, name);
      Utils.hideModal('new-folder-modal');
      Utils.showToast('文件夹创建成功', 'success');
      this.loadFiles();
    } catch (error) {
      Utils.showToast(error.message || '创建文件夹失败', 'error');
    }
  }
  
  async renameItem() {
    const newName = document.getElementById('rename-input').value.trim();
    
    if (!newName) {
      Utils.showToast('请输入新名称', 'warning');
      return;
    }
    
    if (!Utils.isValidFilename(newName)) {
      Utils.showToast('名称包含非法字符', 'warning');
      return;
    }
    
    try {
      await API.rename(this.renameTarget, newName);
      Utils.hideModal('rename-modal');
      Utils.showToast('重命名成功', 'success');
      this.loadFiles();
    } catch (error) {
      Utils.showToast(error.message || '重命名失败', 'error');
    }
  }
  
  async deleteItems() {
    if (this.deleteTargets.length === 0) return;
    
    try {
      await API.deleteFiles(this.deleteTargets);
      Utils.hideModal('delete-modal');
      Utils.showToast(`成功删除 ${this.deleteTargets.length} 个项目`, 'success');
      this.deleteTargets = [];
      this.clearSelection();
      this.loadFiles();
    } catch (error) {
      Utils.showToast(error.message || '删除失败', 'error');
    }
  }
  
  async loadMoveFolderList() {
    try {
      const result = await API.getFiles(this.moveTargetPath);
      this.renderMovePath(result.breadcrumbs);
      this.renderMoveFolderList(result.items.filter(item => item.type === 'folder'));
    } catch (error) {
      Utils.showToast(error.message || '加载文件夹列表失败', 'error');
    }
  }
  
  renderMovePath(breadcrumbs) {
    const container = document.getElementById('move-path');
    container.innerHTML = breadcrumbs.map((crumb, index) => {
      return `
        <a href="#" data-path="${crumb.path}" class="path-item">
          ${crumb.name}
        </a>
      `;
    }).join('');
    
    container.querySelectorAll('.path-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.moveTargetPath = item.dataset.path;
        this.loadMoveFolderList();
      });
    });
  }
  
  renderMoveFolderList(folders) {
    const container = document.getElementById('move-folder-list');
    
    if (folders.length === 0) {
      container.innerHTML = '<div class="folder-item"><span class="icon">📂</span><span class="name">（无子文件夹）</span></div>';
      return;
    }
    
    container.innerHTML = folders.map(folder => {
      const isSelected = this.moveTargetPath === folder.path;
      return `
        <div class="folder-item ${isSelected ? 'selected' : ''}" data-path="${folder.path}">
          <span class="icon">📁</span>
          <span class="name">${folder.name}</span>
          <span class="arrow">▶</span>
        </div>
      `;
    }).join('');
    
    container.querySelectorAll('.folder-item').forEach(item => {
      item.addEventListener('dblclick', () => {
        this.moveTargetPath = item.dataset.path;
        this.loadMoveFolderList();
      });
      
      item.addEventListener('click', () => {
        container.querySelectorAll('.folder-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });
  }
  
  async moveItems() {
    if (this.moveTargets.length === 0) return;
    
    try {
      await API.moveFiles(this.moveTargets, this.moveTargetPath);
      Utils.hideModal('move-modal');
      Utils.showToast(`成功移动 ${this.moveTargets.length} 个项目`, 'success');
      this.moveTargets = [];
      this.clearSelection();
      this.loadFiles();
    } catch (error) {
      Utils.showToast(error.message || '移动失败', 'error');
    }
  }
  
  handleFileUpload(files) {
    if (files.length === 0) return;
    
    const existingNames = this.currentFiles.map(f => f.name);
    
    for (const file of files) {
      if (file.size > CONFIG.MAX_FILE_SIZE) {
        Utils.showToast(`文件 "${file.name}" 超过大小限制（${Utils.formatFileSize(CONFIG.MAX_FILE_SIZE)}）`, 'error');
        continue;
      }
      
      const mimeType = file.type || 'application/octet-stream';
      
      const uploadItem = {
        id: uuidv4(),
        file,
        fileName: file.name,
        fileSize: file.size,
        status: 'pending',
        progress: 0,
        uploadedChunks: 0,
        totalChunks: Math.ceil(file.size / CONFIG.CHUNK_SIZE),
        uploadId: null
      };
      
      this.uploadQueue.push(uploadItem);
    }
    
    this.showUploadProgress();
    this.processUploadQueue();
  }
  
  uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  showUploadProgress() {
    const container = document.getElementById('upload-progress-list');
    container.innerHTML = this.uploadQueue.map(item => `
      <div class="upload-progress-item" data-upload-id="${item.id}">
        <div class="upload-progress-header">
          <span class="icon">📄</span>
          <span class="name">${item.fileName}</span>
          <span class="status ${item.status}">${this.getStatusText(item.status)}</span>
        </div>
        <div class="upload-progress-bar">
          <div class="progress" style="width: ${item.progress}%"></div>
        </div>
        <div class="upload-progress-info">
          <span>${Utils.formatFileSize(item.fileSize)}</span>
          <span>${item.progress}%</span>
        </div>
      </div>
    `).join('');
    
    Utils.showModal('upload-progress-modal');
  }
  
  getStatusText(status) {
    switch (status) {
      case 'pending': return '等待中';
      case 'uploading': return '上传中';
      case 'completed': return '已完成';
      case 'error': return '失败';
      default: return status;
    }
  }
  
  updateUploadProgress(uploadItem) {
    const itemEl = document.querySelector(`.upload-progress-item[data-upload-id="${uploadItem.id}"]`);
    if (!itemEl) return;
    
    itemEl.className = `upload-progress-item ${uploadItem.status}`;
    const statusEl = itemEl.querySelector('.status');
    statusEl.textContent = this.getStatusText(uploadItem.status);
    statusEl.className = `status ${uploadItem.status}`;
    
    const progressBar = itemEl.querySelector('.progress');
    progressBar.style.width = `${uploadItem.progress}%`;
    
    const progressInfo = itemEl.querySelector('.upload-progress-info span:last-child');
    progressInfo.textContent = `${uploadItem.progress}%`;
  }
  
  async processUploadQueue() {
    for (const item of this.uploadQueue) {
      if (item.status === 'pending' || item.status === 'error') {
        await this.uploadFileWithChunks(item);
      }
    }
    
    const allCompleted = this.uploadQueue.every(item => 
      item.status === 'completed' || item.status === 'error'
    );
    
    if (allCompleted) {
      const successCount = this.uploadQueue.filter(item => item.status === 'completed').length;
      const errorCount = this.uploadQueue.filter(item => item.status === 'error').length;
      
      if (successCount > 0) {
        Utils.showToast(`成功上传 ${successCount} 个文件`, 'success');
        this.loadFiles();
      }
      
      if (errorCount > 0) {
        Utils.showToast(`${errorCount} 个文件上传失败`, 'error');
      }
      
      this.uploadQueue = [];
    }
  }
  
  async uploadFileWithChunks(uploadItem) {
    uploadItem.status = 'uploading';
    uploadItem.progress = 0;
    this.updateUploadProgress(uploadItem);
    
    try {
      const initResult = await API.initUpload(
        uploadItem.fileName,
        uploadItem.fileSize,
        uploadItem.totalChunks,
        this.currentPath
      );
      
      uploadItem.uploadId = initResult.uploadId;
      
      const file = uploadItem.file;
      const chunkSize = CONFIG.CHUNK_SIZE;
      
      for (let i = 0; i < uploadItem.totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        const arrayBuffer = await Utils.readFileAsArrayBuffer(chunk);
        const base64Data = Utils.arrayBufferToBase64(arrayBuffer);
        
        await API.uploadChunk(uploadItem.uploadId, i, base64Data);
        
        uploadItem.uploadedChunks = i + 1;
        uploadItem.progress = Math.round(((i + 1) / uploadItem.totalChunks) * 100);
        this.updateUploadProgress(uploadItem);
      }
      
      await API.completeUpload(uploadItem.uploadId);
      
      uploadItem.status = 'completed';
      uploadItem.progress = 100;
      this.updateUploadProgress(uploadItem);
      
    } catch (error) {
      uploadItem.status = 'error';
      this.updateUploadProgress(uploadItem);
      console.error('上传失败:', error);
    }
  }
  
  async previewFile(path) {
    const file = this.currentFiles.find(f => f.path === path);
    if (!file) return;
    
    this.previewPath = path;
    document.getElementById('preview-title').textContent = file.name;
    
    const previewContent = document.getElementById('preview-content');
    const previewUrl = API.getPreviewUrl(path);
    
    previewContent.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>加载中...</p></div>';
    Utils.showModal('preview-modal');
    
    try {
      const mimeType = file.mimeType || '';
      
      if (mimeType.startsWith('image/')) {
        previewContent.innerHTML = `<img src="${previewUrl}" alt="${file.name}">`;
      } else if (mimeType.startsWith('video/')) {
        previewContent.innerHTML = `<video controls src="${previewUrl}">您的浏览器不支持视频播放</video>`;
      } else if (mimeType.startsWith('audio/')) {
        previewContent.innerHTML = `<audio controls src="${previewUrl}">您的浏览器不支持音频播放</audio>`;
      } else if (mimeType === 'application/pdf') {
        previewContent.innerHTML = `<iframe class="pdf-preview" src="${previewUrl}"></iframe>`;
      } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        try {
          const response = await fetch(previewUrl);
          const text = await response.text();
          previewContent.innerHTML = `<pre class="text-preview">${this.escapeHtml(text)}</pre>`;
        } catch (e) {
          this.showUnsupportedPreview(mimeType);
        }
      } else {
        this.showUnsupportedPreview(mimeType);
      }
    } catch (error) {
      this.showUnsupportedPreview(mimeType);
    }
  }
  
  showUnsupportedPreview(mimeType) {
    const previewContent = document.getElementById('preview-content');
    previewContent.innerHTML = `
      <div class="unsupported">
        <div class="icon">📄</div>
        <p>该文件类型暂不支持预览</p>
        <p style="font-size: 12px; color: #999;">类型: ${mimeType || '未知'}</p>
      </div>
    `;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  showLoading() {
    document.getElementById('file-list').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('hidden');
  }
  
  hideLoading() {
    document.getElementById('loading-state').classList.add('hidden');
  }
  
  showEmpty() {
    document.getElementById('file-list').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
  }
  
  hideEmpty() {
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('file-list').classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FileManagerApp();
});
