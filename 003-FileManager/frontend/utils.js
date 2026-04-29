const Utils = {
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },
  
  getFileIcon(type, mimeType) {
    if (type === 'folder') {
      return '📁';
    }
    
    if (mimeType) {
      if (mimeType.startsWith('image/')) {
        return '🖼️';
      }
      if (mimeType.startsWith('video/')) {
        return '🎥';
      }
      if (mimeType.startsWith('audio/')) {
        return '🎵';
      }
      if (mimeType === 'application/pdf') {
        return '📄';
      }
      if (mimeType.includes('word') || mimeType.includes('document')) {
        return '📝';
      }
      if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        return '📊';
      }
      if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) {
        return '📦';
      }
      if (mimeType.includes('text/')) {
        return '📄';
      }
    }
    
    return '📄';
  },
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  async readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },
  
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },
  
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  },
  
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal && overlay) {
      modal.classList.remove('hidden');
      overlay.classList.remove('hidden');
    }
  },
  
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal) {
      modal.classList.add('hidden');
    }
    
    const visibleModals = document.querySelectorAll('.modal:not(.hidden)');
    if (visibleModals.length === 0 && overlay) {
      overlay.classList.add('hidden');
    }
  },
  
  hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    const overlay = document.getElementById('modal-overlay');
    
    modals.forEach(modal => modal.classList.add('hidden'));
    if (overlay) {
      overlay.classList.add('hidden');
    }
  },
  
  getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
  },
  
  generateUniqueFilename(filename, existingNames) {
    const ext = this.getFileExtension(filename);
    const baseName = ext ? filename.slice(0, -(ext.length + 1)) : filename;
    let newName = filename;
    let counter = 1;
    
    while (existingNames.includes(newName)) {
      newName = ext ? `${baseName} (${counter}).${ext}` : `${baseName} (${counter})`;
      counter++;
    }
    
    return newName;
  },
  
  isValidFilename(filename) {
    const invalidChars = /[<>:"/\\|?*]/;
    return !invalidChars.test(filename) && filename.trim() !== '';
  }
};
