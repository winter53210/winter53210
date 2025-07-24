const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// 连接MongoDB数据库
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://3033669682:pdmObf3f2cLIfgf3@cluster0.xxxx.mongodb.net/city_memory?retryWrites=true&w=majority';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB连接错误:'));
db.once('open', () => {
  console.log('MongoDB连接成功');
});

// 定义数据模型
// 用户模型
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  email: String,
  registered_at: { type: Date, default: Date.now },
  last_login: Date
});

// 记忆模型
const MemorySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  theme: { type: String, required: true },
  emotion: { type: String, required: true },
  description: String,
  longitude: { type: Number, required: true },
  latitude: { type: Number, required: true },
  date: { type: String, required: true },
  privacy: { type: String, default: 'public' },
  images: [String],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// 点赞模型
const LikeSchema = new mongoose.Schema({
  memory_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
  unique: true
});

// 创建模型
const User = mongoose.model('User', UserSchema);
const Memory = mongoose.model('Memory', MemorySchema);
const Like = mongoose.model('Like', LikeSchema);

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public')); // 存放前端文件

// JWT 认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: '需要登录' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: '登录已过期' });
    }
    req.user = user;
    next();
  });
};

// ========== 用户相关 API ==========

// 用户注册
app.post('/api/register', async (req, res) => {
  const { username, password, email = '' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  if (username.length < 3) {
    return res.status(400).json({ success: false, message: '用户名至少需要3个字符' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: '密码至少需要6个字符' });
  }

  try {
    // 检查用户名是否已存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建新用户
    const newUser = new User({
      username,
      password_hash: passwordHash,
      email
    });

    await newUser.save();
    res.json({ success: true, message: '注册成功', userId: newUser._id });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: '用户名不存在' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ success: false, message: '密码错误' });
    }

    // 更新最后登录时间
    user.last_login = new Date();
    await user.save();

    // 生成 JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '登录成功',
      token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取当前用户信息
app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email
    }
  });
});

// ========== 记忆相关 API ==========

// 获取记忆列表
app.get('/api/memories', authenticateToken, async (req, res) => {
  const { view = 'all' } = req.query;
  
  try {
    let memories;
    
    if (view === 'my') {
      // 只获取当前用户的记忆
      memories = await Memory.find({ user_id: req.user.id })
        .sort({ date: -1, created_at: -1 });
    } else {
      // 获取所有可见记忆（公开 + 当前用户私密）
      memories = await Memory.find({
        $or: [
          { privacy: 'public' },
          { user_id: req.user.id }
        ]
      }).sort({ date: -1, created_at: -1 });
    }

    // 获取每个记忆的点赞数和当前用户是否点赞
    const memoryList = await Promise.all(memories.map(async (memory) => {
      const likeCount = await Like.countDocuments({ memory_id: memory._id });
      const userLiked = await Like.findOne({ 
        memory_id: memory._id, 
        user_id: req.user.id 
      });
      
      // 获取用户名
      const user = await User.findById(memory.user_id);
      
      return {
        id: memory._id,
        title: memory.title,
        theme: memory.theme,
        emotion: memory.emotion,
        description: memory.description,
        longitude: memory.longitude,
        latitude: memory.latitude,
        date: memory.date,
        privacy: memory.privacy,
        images: memory.images || [],
        username: user ? user.username : '',
        createdAt: memory.created_at,
        updatedAt: memory.updated_at,
        likeCount,
        liked: !!userLiked
      };
    }));

    res.json({ success: true, memories: memoryList });
  } catch (error) {
    console.error('获取记忆失败:', error);
    res.status(500).json({ success: false, message: '获取记忆失败' });
  }
});

// 创建记忆
app.post('/api/memories', authenticateToken, async (req, res) => {
  const {
    title,
    theme,
    emotion,
    description,
    longitude,
    latitude,
    date,
    privacy = 'public',
    images = []
  } = req.body;

  if (!title || !theme || !emotion || !longitude || !latitude || !date) {
    return res.status(400).json({ success: false, message: '缺少必要字段' });
  }

  try {
    const newMemory = new Memory({
      user_id: req.user.id,
      title,
      theme,
      emotion,
      description,
      longitude,
      latitude,
      date,
      privacy,
      images
    });

    await newMemory.save();
    
    // 获取用户名
    const user = await User.findById(req.user.id);

    const memory = {
      id: newMemory._id,
      title: newMemory.title,
      theme: newMemory.theme,
      emotion: newMemory.emotion,
      description: newMemory.description,
      longitude: newMemory.longitude,
      latitude: newMemory.latitude,
      date: newMemory.date,
      privacy: newMemory.privacy,
      images: newMemory.images || [],
      username: user ? user.username : '',
      createdAt: newMemory.created_at,
      updatedAt: newMemory.updated_at
    };

    res.json({ success: true, id: newMemory._id, memory });
  } catch (error) {
    console.error('创建记忆失败:', error);
    res.status(500).json({ success: false, message: '创建记忆失败' });
  }
});

// 更新记忆
app.put('/api/memories/:id', authenticateToken, async (req, res) => {
  const memoryId = req.params.id;
  const {
    title,
    theme,
    emotion,
    description,
    date,
    privacy,
    images
  } = req.body;

  try {
    // 先检查记忆是否存在且属于当前用户
    const memory = await Memory.findOne({ _id: memoryId, user_id: req.user.id });
    if (!memory) {
      return res.status(404).json({ success: false, message: '记忆不存在或无权限' });
    }

    // 验证必填字段
    if (!title || !theme || !emotion || !date) {
      return res.status(400).json({ success: false, message: '缺少必要字段' });
    }

    // 更新记忆
    memory.title = title;
    memory.theme = theme;
    memory.emotion = emotion;
    memory.description = description;
    memory.date = date;
    memory.privacy = privacy;
    memory.images = images || [];
    memory.updated_at = new Date();

    await memory.save();
    
    // 获取用户名
    const user = await User.findById(req.user.id);

    const updatedMemory = {
      id: memory._id,
      title: memory.title,
      theme: memory.theme,
      emotion: memory.emotion,
      description: memory.description,
      longitude: memory.longitude,
      latitude: memory.latitude,
      date: memory.date,
      privacy: memory.privacy,
      images: memory.images || [],
      username: user ? user.username : '',
      createdAt: memory.created_at,
      updatedAt: memory.updated_at
    };

    res.json({ success: true, memory: updatedMemory });
  } catch (error) {
    console.error('更新记忆失败:', error);
    res.status(500).json({ success: false, message: '更新记忆失败: ' + error.message });
  }
});

// 删除记忆
app.delete('/api/memories/:id', authenticateToken, async (req, res) => {
  const memoryId = req.params.id;

  try {
    const result = await Memory.deleteOne({ _id: memoryId, user_id: req.user.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: '记忆不存在或无权限' });
    }

    // 同时删除相关的点赞
    await Like.deleteMany({ memory_id: memoryId });

    res.json({ success: true, message: '记忆已删除' });
  } catch (error) {
    console.error('删除记忆失败:', error);
    res.status(500).json({ success: false, message: '删除记忆失败' });
  }
});

// 点赞/取消点赞
app.post('/api/memories/:id/like', authenticateToken, async (req, res) => {
  const memoryId = req.params.id;
  const userId = req.user.id;

  try {
    // 先检查记忆是否存在和可见性
    const memory = await Memory.findOne({
      _id: memoryId,
      $or: [
        { privacy: 'public' },
        { user_id: userId }
      ]
    });

    if (!memory) {
      return res.status(404).json({ success: false, message: '记忆不存在或无权限访问' });
    }

    // 检查是否已经点赞
    const like = await Like.findOne({ memory_id: memoryId, user_id: userId });

    if (like) {
      // 取消点赞
      await Like.deleteOne({ _id: like._id });
    } else {
      // 添加点赞
      const newLike = new Like({
        memory_id: memoryId,
        user_id: userId
      });
      await newLike.save();
    }

    // 获取新的点赞数
    const likeCount = await Like.countDocuments({ memory_id: memoryId });
    
    res.json({
      success: true,
      liked: !like,
      likeCount
    });
  } catch (error) {
    console.error('点赞操作失败:', error);
    res.status(500).json({ success: false, message: '数据库错误' });
  }
});

// ========== 数据导出/导入 API ==========

// 导出用户数据
app.get('/api/user/export', authenticateToken, async (req, res) => {
  try {
    // 获取用户信息
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 获取用户的所有记忆
    const memories = await Memory.find({ user_id: req.user.id });
    
    const exportData = {
      version: '6.0',
      exportTime: new Date().toISOString(),
      username: user.username,
      userInfo: {
        email: user.email,
        registeredAt: user.registered_at,
        lastLogin: user.last_login
      },
      memories: await Promise.all(memories.map(async (m) => {
        const likeCount = await Like.countDocuments({ memory_id: m._id });
        return {
          id: m._id,
          title: m.title,
          theme: m.theme,
          emotion: m.emotion,
          description: m.description,
          longitude: m.longitude,
          latitude: m.latitude,
          date: m.date,
          privacy: m.privacy,
          images: m.images || [],
          createdAt: m.created_at,
          updatedAt: m.updated_at,
          likeCount
        };
      })),
      storageInfo: {
        type: 'mongodb',
        isPersistent: true
      }
    };

    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

// 导入用户数据
app.post('/api/user/import', authenticateToken, async (req, res) => {
  const { data } = req.body;

  if (!data || !data.memories || !Array.isArray(data.memories)) {
    return res.status(400).json({ success: false, message: '无效的数据格式' });
  }

  try {
    // 删除当前用户的所有记忆和点赞
    await Memory.deleteMany({ user_id: req.user.id });
    await Like.deleteMany({ user_id: req.user.id });

    // 导入新数据
    let successCount = 0;
    
    for (const memory of data.memories) {
      try {
        const newMemory = new Memory({
          user_id: req.user.id,
          title: memory.title,
          theme: memory.theme,
          emotion: memory.emotion,
          description: memory.description,
          longitude: memory.longitude,
          latitude: memory.latitude,
          date: memory.date,
          privacy: memory.privacy || 'public',
          images: memory.images || [],
          created_at: memory.createdAt ? new Date(memory.createdAt) : new Date(),
          updated_at: memory.updatedAt ? new Date(memory.updatedAt) : new Date()
        });

        await newMemory.save();
        successCount++;
      } catch (error) {
        console.error('导入记忆失败:', error);
      }
    }

    res.json({ success: true, count: successCount });
  } catch (error) {
    console.error('导入数据失败:', error);
    res.status(500).json({ success: false, message: '清除现有数据失败' });
  }
});

// ========== 统计信息 API ==========

// 获取用户统计信息
app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    // 总记忆数
    const totalMemories = await Memory.countDocuments({ user_id: req.user.id });
    
    // 主题统计
    const themes = {};
    const themeData = await Memory.aggregate([
      { $match: { user_id: mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$theme', count: { $sum: 1 } } }
    ]);
    themeData.forEach(item => {
      themes[item._id] = item.count;
    });
    
    // 情绪统计
    const emotions = {};
    const emotionData = await Memory.aggregate([
      { $match: { user_id: mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$emotion', count: { $sum: 1 } } }
    ]);
    emotionData.forEach(item => {
      emotions[item._id] = item.count;
    });
    
    // 月度统计
    const monthlyCount = {};
    const monthData = await Memory.aggregate([
      { $match: { user_id: mongoose.Types.ObjectId(req.user.id) } },
      { $group: { 
        _id: { $substr: ['$date', 0, 7] }, 
        count: { $sum: 1 } 
      }},
      { $sort: { _id: 1 } }
    ]);
    monthData.forEach(item => {
      monthlyCount[item._id] = item.count;
    });

    const stats = {
      totalMemories,
      themes,
      emotions,
      monthlyCount,
      storage: { type: 'mongodb', isPersistent: true }
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ success: false, message: '获取统计信息失败' });
  }
});

// ========== 静态文件服务和启动 ==========

// 提供前端文件服务
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`城市记忆服务器启动成功！`);
  console.log(`服务器地址: http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止服务器');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  mongoose.connection.close(() => {
    console.log('MongoDB连接已关闭');
    process.exit(0);
  });
});