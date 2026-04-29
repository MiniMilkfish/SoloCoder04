const API = {
  getToken: () => localStorage.getItem(CONFIG.TOKEN_KEY),
  getUser: () => {
    const user = localStorage.getItem(CONFIG.USER_KEY);
    return user ? JSON.parse(user) : null;
  },
  setAuth: (token, user) => {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  },
  clearAuth: () => {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  },
  
  async request(url, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}${url}`, {
        ...options,
        headers,
        credentials: 'include'
      });
      
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || '请求失败');
        }
        
        return data;
      } else {
        return response;
      }
    } catch (error) {
      if (error.message === '令牌无效' || error.message === '未授权访问') {
        this.clearAuth();
        window.location.reload();
      }
      throw error;
    }
  },
  
  async login(username, password) {
    return this.request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },
  
  async getFiles(path = '/', search = '', sort = 'name', order = 'asc', filter = 'all') {
    const params = new URLSearchParams({
      path,
      search,
      sort,
      order,
      filter
    });
    return this.request(`/api/files?${params.toString()}`);
  },
  
  async createFolder(path, name) {
    return this.request('/api/folder', {
      method: 'POST',
      body: JSON.stringify({ path, name })
    });
  },
  
  async deleteFiles(paths) {
    return this.request('/api/file', {
      method: 'DELETE',
      body: JSON.stringify({ paths })
    });
  },
  
  async rename(path, newName) {
    return this.request('/api/rename', {
      method: 'PUT',
      body: JSON.stringify({ path, newName })
    });
  },
  
  async moveFiles(paths, targetPath) {
    return this.request('/api/move', {
      method: 'POST',
      body: JSON.stringify({ paths, targetPath })
    });
  },
  
  async initUpload(fileName, fileSize, totalChunks, path) {
    return this.request('/api/upload/init', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileSize, totalChunks, path })
    });
  },
  
  async uploadChunk(uploadId, chunkIndex, chunkData) {
    return this.request('/api/upload/chunk', {
      method: 'POST',
      body: JSON.stringify({ uploadId, chunkIndex, chunkData })
    });
  },
  
  async completeUpload(uploadId) {
    return this.request('/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ uploadId })
    });
  },
  
  async checkUpload(uploadId) {
    return this.request('/api/upload/check', {
      method: 'POST',
      body: JSON.stringify({ uploadId })
    });
  },
  
  async getLogs(page = 1, limit = 50) {
    const params = new URLSearchParams({ page, limit });
    return this.request(`/api/logs?${params.toString()}`);
  },
  
  async getConfig() {
    return this.request('/api/config');
  },
  
  getDownloadUrl(path) {
    const token = this.getToken();
    return `${CONFIG.API_BASE_URL}/api/download?path=${encodeURIComponent(path)}&token=${token}`;
  },
  
  getPreviewUrl(path) {
    const token = this.getToken();
    return `${CONFIG.API_BASE_URL}/api/preview?path=${encodeURIComponent(path)}&token=${token}`;
  }
};
