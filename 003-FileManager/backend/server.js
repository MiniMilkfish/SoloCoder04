const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mime = require('mime-types');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'file-manager-secret-key-2024';
const STORAGE_PATH = path.join(__dirname, '..', 'storage');
const TEMP_PATH = path.join(__dirname, '..', 'temp');
const DATA_PATH = path.join(__dirname, '..', 'data');
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const CHUNK_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/html', 'text/css', 'text/javascript',
  'application/json',
  'application/zip', 'application/x-rar-compressed',
  'video/mp4', 'video/webm', 'video/ogg',
  'audio/mpeg', 'audio/ogg', 'audio/wav'
];

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const FRONTEND_PATH = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_PATH));

fs.ensureDirSync(STORAGE_PATH);
fs.ensureDirSync(TEMP_PATH);
fs.ensureDirSync(DATA_PATH);

let users = [
  { id: '1', username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'admin' },
  { id: '2', username: 'user', password: bcrypt.hashSync('user123', 10), role: 'user' }
];

let logs = [];

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) {
    return res.status(401).json({ error: '未授权访问' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: '令牌无效' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足，需要管理员权限' });
  }
  next();
};

const sanitizePath = (userPath) => {
  if (!userPath || userPath === '/' || userPath === '\\') {
    return STORAGE_PATH;
  }
  
  let cleanedPath = userPath;
  while (cleanedPath.startsWith('/') || cleanedPath.startsWith('\\')) {
    cleanedPath = cleanedPath.slice(1);
  }
  while (cleanedPath.startsWith('./') || cleanedPath.startsWith('.\\')) {
    cleanedPath = cleanedPath.slice(2);
  }
  
  const normalizedPath = path.normalize(cleanedPath);
  if (normalizedPath.includes('..') || normalizedPath === '..') {
    throw new Error('非法路径访问');
  }
  
  const absolutePath = path.join(STORAGE_PATH, normalizedPath);
  
  const resolvedBase = path.resolve(STORAGE_PATH);
  const resolvedTarget = path.resolve(absolutePath);
  
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && 
      resolvedTarget !== resolvedBase) {
    throw new Error('非法路径访问');
  }
  
  return absolutePath;
};

const addLog = (action, path, user) => {
  logs.unshift({
    id: uuidv4(),
    action,
    path,
    user: user.username,
    role: user.role,
    timestamp: new Date().toISOString()
  });
  if (logs.length > 1000) logs.pop();
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/files', authMiddleware, (req, res) => {
  try {
    const { path: userPath = '/', search = '', sort = 'name', order = 'asc', filter = 'all' } = req.query;
    
    let targetPath;
    try {
      targetPath = sanitizePath(userPath);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: '路径不存在' });
    }
    
    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: '不是目录' });
    }
    
    let items = fs.readdirSync(targetPath).map(name => {
      const fullPath = path.join(targetPath, name);
      const stat = fs.statSync(fullPath);
      const relativePath = path.join(userPath, name).replace(/\\/g, '/');
      return {
        name,
        path: relativePath.startsWith('/') ? relativePath : '/' + relativePath,
        type: stat.isDirectory() ? 'folder' : 'file',
        size: stat.size,
        sizeFormatted: formatFileSize(stat.size),
        modified: stat.mtime.toISOString(),
        mimeType: stat.isFile() ? mime.lookup(name) || 'application/octet-stream' : null,
        extension: stat.isFile() ? path.extname(name).toLowerCase() : null
      };
    });
    
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(item => item.name.toLowerCase().includes(searchLower));
    }
    
    if (filter !== 'all') {
      if (filter === 'folder') {
        items = items.filter(item => item.type === 'folder');
      } else if (filter === 'image') {
        items = items.filter(item => item.type === 'file' && item.mimeType?.startsWith('image/'));
      } else if (filter === 'document') {
        items = items.filter(item => {
          if (item.type !== 'file') return false;
          const docTypes = ['application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'];
          return docTypes.includes(item.mimeType || '');
        });
      } else if (filter === 'video') {
        items = items.filter(item => item.type === 'file' && item.mimeType?.startsWith('video/'));
      }
    }
    
    items.sort((a, b) => {
      if (sort === 'name') {
        return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else if (sort === 'size') {
        return order === 'asc' ? a.size - b.size : b.size - a.size;
      } else if (sort === 'modified') {
        return order === 'asc' ? new Date(a.modified) - new Date(b.modified) : new Date(b.modified) - new Date(a.modified);
      } else if (sort === 'type') {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return order === 'asc' ? (a.extension || '').localeCompare(b.extension || '') : (b.extension || '').localeCompare(a.extension || '');
      }
      return 0;
    });
    
    items.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return 0;
    });
    
    const breadcrumbs = [];
    let current = '';
    const parts = userPath.split('/').filter(p => p);
    breadcrumbs.push({ name: '根目录', path: '/' });
    parts.forEach(part => {
      current += '/' + part;
      breadcrumbs.push({ name: part, path: current });
    });
    
    res.json({
      items,
      breadcrumbs,
      currentPath: userPath
    });
    
    addLog('list', userPath, req.user);
  } catch (error) {
    console.error('获取文件列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/folder', authMiddleware, (req, res) => {
  try {
    const { path: userPath, name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '文件夹名称不能为空' });
    }
    
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      return res.status(400).json({ error: '文件夹名称包含非法字符' });
    }
    
    let targetPath;
    try {
      targetPath = sanitizePath(path.join(userPath || '/', name));
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (fs.existsSync(targetPath)) {
      return res.status(400).json({ error: '文件夹已存在' });
    }
    
    fs.ensureDirSync(targetPath);
    
    res.json({ success: true, message: '文件夹创建成功' });
    addLog('create_folder', path.join(userPath || '/', name), req.user);
  } catch (error) {
    console.error('创建文件夹错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.delete('/api/file', authMiddleware, (req, res) => {
  try {
    const { paths } = req.body;
    
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: '请选择要删除的文件或文件夹' });
    }
    
    const errors = [];
    const deleted = [];
    
    for (const userPath of paths) {
      try {
        const targetPath = sanitizePath(userPath);
        
        if (!fs.existsSync(targetPath)) {
          errors.push({ path: userPath, error: '不存在' });
          continue;
        }
        
        fs.removeSync(targetPath);
        deleted.push(userPath);
        addLog('delete', userPath, req.user);
      } catch (error) {
        errors.push({ path: userPath, error: error.message });
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ error: '部分文件删除失败', errors, deleted });
    }
    
    res.json({ success: true, message: `成功删除 ${deleted.length} 个文件/文件夹`, deleted });
  } catch (error) {
    console.error('删除错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.put('/api/rename', authMiddleware, (req, res) => {
  try {
    const { path: userPath, newName } = req.body;
    
    if (!newName || newName.trim() === '') {
      return res.status(400).json({ error: '新名称不能为空' });
    }
    
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(newName)) {
      return res.status(400).json({ error: '名称包含非法字符' });
    }
    
    let oldPath;
    let newPath;
    
    try {
      oldPath = sanitizePath(userPath);
      const parentDir = path.dirname(userPath);
      newPath = sanitizePath(path.join(parentDir, newName));
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: '文件或文件夹不存在' });
    }
    
    if (fs.existsSync(newPath)) {
      return res.status(400).json({ error: '目标名称已存在' });
    }
    
    fs.renameSync(oldPath, newPath);
    
    res.json({ success: true, message: '重命名成功' });
    addLog('rename', `${userPath} -> ${newName}`, req.user);
  } catch (error) {
    console.error('重命名错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/move', authMiddleware, (req, res) => {
  try {
    const { paths, targetPath } = req.body;
    
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: '请选择要移动的文件或文件夹' });
    }
    
    if (!targetPath) {
      return res.status(400).json({ error: '请选择目标路径' });
    }
    
    let destPath;
    try {
      destPath = sanitizePath(targetPath);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (!fs.existsSync(destPath) || !fs.statSync(destPath).isDirectory()) {
      return res.status(400).json({ error: '目标路径不是有效的文件夹' });
    }
    
    const errors = [];
    const moved = [];
    
    for (const userPath of paths) {
      try {
        const srcPath = sanitizePath(userPath);
        
        if (!fs.existsSync(srcPath)) {
          errors.push({ path: userPath, error: '不存在' });
          continue;
        }
        
        const fileName = path.basename(srcPath);
        const newPath = path.join(destPath, fileName);
        
        if (fs.existsSync(newPath)) {
          errors.push({ path: userPath, error: '目标位置已存在同名文件' });
          continue;
        }
        
        if (fs.statSync(srcPath).isDirectory()) {
          if (newPath.startsWith(srcPath + path.sep)) {
            errors.push({ path: userPath, error: '不能将文件夹移动到其子文件夹' });
            continue;
          }
        }
        
        fs.renameSync(srcPath, newPath);
        moved.push(userPath);
        addLog('move', `${userPath} -> ${targetPath}`, req.user);
      } catch (error) {
        errors.push({ path: userPath, error: error.message });
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ error: '部分文件移动失败', errors, moved });
    }
    
    res.json({ success: true, message: `成功移动 ${moved.length} 个文件/文件夹`, moved });
  } catch (error) {
    console.error('移动错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/download', authMiddleware, (req, res) => {
  try {
    const { path: userPath } = req.query;
    
    if (!userPath) {
      return res.status(400).json({ error: '请指定要下载的文件' });
    }
    
    let filePath;
    try {
      filePath = sanitizePath(userPath);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '不能下载文件夹' });
    }
    
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    const fileName = path.basename(filePath);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', stats.size);
    
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
    
    readStream.on('error', (err) => {
      console.error('下载错误:', err);
      res.status(500).json({ error: '下载失败' });
    });
    
    addLog('download', userPath, req.user);
  } catch (error) {
    console.error('下载错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/preview', authMiddleware, (req, res) => {
  try {
    const { path: userPath } = req.query;
    
    if (!userPath) {
      return res.status(400).json({ error: '请指定要预览的文件' });
    }
    
    let filePath;
    try {
      filePath = sanitizePath(userPath);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '不能预览文件夹' });
    }
    
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    const previewableTypes = ['image/', 'text/', 'application/pdf', 'video/', 'audio/'];
    const isPreviewable = previewableTypes.some(type => mimeType.startsWith(type));
    
    if (!isPreviewable) {
      return res.status(400).json({ error: '该文件类型不支持预览' });
    }
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);
    
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
    
    readStream.on('error', (err) => {
      console.error('预览错误:', err);
      res.status(500).json({ error: '预览失败' });
    });
    
    addLog('preview', userPath, req.user);
  } catch (error) {
    console.error('预览错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

const chunkUploads = new Map();

app.post('/api/upload/init', authMiddleware, (req, res) => {
  try {
    const { fileName, fileSize: fileSizeStr, totalChunks: totalChunksStr, path: userPath = '/' } = req.body;
    
    if (!fileName || !fileSizeStr || !totalChunksStr) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const fileSize = parseInt(fileSizeStr);
    const totalChunks = parseInt(totalChunksStr);
    
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `文件大小超过限制，最大允许 ${formatFileSize(MAX_FILE_SIZE)}` });
    }
    
    const mimeType = mime.lookup(fileName) || 'application/octet-stream';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: '不支持的文件类型' });
    }
    
    let targetDir;
    try {
      targetDir = sanitizePath(userPath);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      return res.status(400).json({ error: '目标路径不是有效的文件夹' });
    }
    
    const targetPath = path.join(targetDir, fileName);
    if (fs.existsSync(targetPath)) {
      return res.status(409).json({ 
        error: '文件已存在',
        existing: true,
        fileName
      });
    }
    
    const uploadId = uuidv4();
    const tempDir = path.join(TEMP_PATH, uploadId);
    fs.ensureDirSync(tempDir);
    
    chunkUploads.set(uploadId, {
      uploadId,
      fileName,
      fileSize,
      totalChunks,
      targetPath,
      tempDir,
      receivedChunks: [],
      userPath
    });
    
    res.json({
      uploadId,
      chunkSize: CHUNK_SIZE,
      totalChunks
    });
    
    addLog('upload_init', userPath + '/' + fileName, req.user);
  } catch (error) {
    console.error('初始化上传错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/upload/chunk', authMiddleware, (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    
    if (!uploadId || chunkIndex === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const upload = chunkUploads.get(uploadId);
    if (!upload) {
      return res.status(404).json({ error: '上传会话不存在' });
    }
    
    const chunkIndexNum = parseInt(chunkIndex);
    if (chunkIndexNum < 0 || chunkIndexNum >= upload.totalChunks) {
      return res.status(400).json({ error: '分片索引无效' });
    }
    
    if (!req.body.chunkData) {
      return res.status(400).json({ error: '缺少分片数据' });
    }
    
    const chunkPath = path.join(upload.tempDir, `chunk_${chunkIndexNum}`);
    
    const chunkBuffer = Buffer.from(req.body.chunkData, 'base64');
    
    fs.writeFileSync(chunkPath, chunkBuffer);
    
    if (!upload.receivedChunks.includes(chunkIndexNum)) {
      upload.receivedChunks.push(chunkIndexNum);
    }
    
    const progress = Math.round((upload.receivedChunks.length / upload.totalChunks) * 100);
    
    res.json({
      success: true,
      chunkIndex: chunkIndexNum,
      received: upload.receivedChunks.length,
      total: upload.totalChunks,
      progress
    });
  } catch (error) {
    console.error('上传分片错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/upload/complete', authMiddleware, (req, res) => {
  try {
    const { uploadId } = req.body;
    
    if (!uploadId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const upload = chunkUploads.get(uploadId);
    if (!upload) {
      return res.status(404).json({ error: '上传会话不存在' });
    }
    
    if (upload.receivedChunks.length !== upload.totalChunks) {
      return res.status(400).json({ 
        error: '分片未全部上传',
        received: upload.receivedChunks.length,
        total: upload.totalChunks
      });
    }
    
    const writeStream = fs.createWriteStream(upload.targetPath);
    
    const mergeChunks = async () => {
      for (let i = 0; i < upload.totalChunks; i++) {
        const chunkPath = path.join(upload.tempDir, `chunk_${i}`);
        const chunkBuffer = fs.readFileSync(chunkPath);
        writeStream.write(chunkBuffer);
      }
      writeStream.end();
    };
    
    mergeChunks().then(() => {
      fs.removeSync(upload.tempDir);
      chunkUploads.delete(uploadId);
      
      res.json({
        success: true,
        message: '文件上传成功',
        fileName: upload.fileName,
        path: upload.userPath + '/' + upload.fileName
      });
      
      addLog('upload_complete', upload.userPath + '/' + upload.fileName, req.user);
    }).catch((error) => {
      console.error('合并分片错误:', error);
      res.status(500).json({ error: '合并分片失败' });
    });
  } catch (error) {
    console.error('完成上传错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/upload/check', authMiddleware, (req, res) => {
  try {
    const { uploadId } = req.body;
    
    if (!uploadId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const upload = chunkUploads.get(uploadId);
    if (!upload) {
      return res.status(404).json({ error: '上传会话不存在' });
    }
    
    res.json({
      uploadId: upload.uploadId,
      fileName: upload.fileName,
      totalChunks: upload.totalChunks,
      receivedChunks: upload.receivedChunks,
      progress: Math.round((upload.receivedChunks.length / upload.totalChunks) * 100)
    });
  } catch (error) {
    console.error('检查上传状态错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/logs', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    
    const paginatedLogs = logs.slice(start, end);
    
    res.json({
      logs: paginatedLogs,
      total: logs.length,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('获取日志错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/config', authMiddleware, (req, res) => {
  res.json({
    maxFileSize: MAX_FILE_SIZE,
    maxFileSizeFormatted: formatFileSize(MAX_FILE_SIZE),
    chunkSize: CHUNK_SIZE,
    chunkSizeFormatted: formatFileSize(CHUNK_SIZE),
    allowedTypes: ALLOWED_TYPES,
    userRole: req.user.role
  });
});

app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  文件管理系统启动成功!`);
  console.log(`========================================`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  API 地址: http://localhost:${PORT}/api`);
  console.log(`----------------------------------------`);
  console.log(`  默认管理员账号: admin / admin123`);
  console.log(`  普通用户账号: user / user123`);
  console.log(`========================================`);
});
