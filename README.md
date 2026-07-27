# TodoList — 个人本地代办事务系统（自用）

纯个人用的个人事务管理网站，内置白噪声系统、沉浸式专注模式、树状灵感（New Idea）记录系统。不过目前并没有作任何用户数据分离，纯本地单用户，有空会搞搞。
版本1.0

---

## 功能一览

### 事务管理
- 创建、编辑、重命名、删除事务
- **开始 / 暂停 / 继续 / 完成** 支持实时计时
- 每次专注时长自动累计，跨会话保留
- 服务器意外退出时自动保存当前时段

### 沉浸模式
- 事务列表点击「开始」→ 一键进入全屏沉浸视图
- 显示实时计时器 + 事务标题 + New Idea 侧面板
- 暂停/继续按钮**原地切换**，无需跳转页面
- 退出返回事务列表，会话状态不变

### New Idea 灵感记录
- 沉浸模式下左侧面板随时记录想法（Enter 发送）
- **一键提升**为正式事务
- `/ideas` 页面：**树状结构**展示所有灵感
  - 支持无限嵌套子想法
  - **拖拽**改变层级关系或分配到分类
  - 拖到**根区域**脱离父节点
- 导出整个灵感树为 **TXT / Markdown / Word (.doc)**

### 分类系统
- 自定义分类目录，每条灵感可归属一个分类
- 每个分类有独立**颜色**（15 种区分色，自动分配未使用的）
- 分类名称以**文字颜色**显示（半透明底色）
- 灵感树中可按分类筛选
- 将灵感直接**拖拽到分类**完成分配

### 白噪声
- 支持上传 mp3 / wav / ogg / m4a / flac / webm（上限 200MB）
- 侧栏迷你播放器或沉浸模式控件均可播放/暂停
- 开始事务**自动播放**、暂停/完成**自动暂停**
- 沉浸模式中有播放进度条 + 音量滑块
- 多曲目间切换

### 计时与等级系统
- 每个事务自动记录**时间片段**（开始 → 暂停/完成）
- `/profile` 个人页面展示：
  - 所有事务累计专注总时长
  - **等级阶梯**（按累计小时数）
    - Lv.1 0h → Lv.2 5h → Lv.3 15h → Lv.4 30h → ... → Lv.9 800h
  - 经验值进度条，直观看到距下一级还有多远
  - 已完成事务数量

### 系统日志
- 所有操作记录到数据库 + 文件 `server/logs/app.log`
- `/logs` 页面查看，暗色终端风格
- 可一键清空



## 快速开始

### 环境要求
- **Node.js** ≥ 18（已在 v24 测试通过）
- **npm** ≥ 9

### Windows 一键安装

```
1. Install Node.js  https://nodejs.org/  (LTS version)
2. Download source (git clone or unzip)
3. Double-click install.bat — installs all dependencies
4. Double-click start.bat  — starts the app
5. Open http://localhost:5173
```

### 手动安装（通用）

```bash
# 克隆项目
git clone <仓库地址> TodoList
cd TodoList

# 安装所有依赖
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 启动
npm run dev
```

启动后同时运行：
- **后端** → `http://localhost:3001`（Express + SQLite）
- **前端** → `http://localhost:5173`（Vite + React）

### 更新到最新版

**Windows: double-click `update.bat`** (pulls latest code, reinstalls deps, preserves your data)

或在终端中：

```bash
git pull
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### First Launch
- Database created automatically at `server/data/todolist.db`
- **Sample data** auto-generated: 5 categories, 4 tasks, 11 new ideas (with nesting)
- **Default white noise** (4 MP3 tracks) copied to your library
- Upload more audio at `/audio`

---

## 数据存储

| 数据 | 位置 |
|---|---|
| 数据库 | `server/data/todolist.db` |
| 音频文件 | `server/data/audio/` |
| 日志文件 | `server/logs/app.log` |

所有用户数据均在 `server/data/` 目录下 —— 删除该目录可重置数据，或保留用于备份迁移。

> ⚠️ **单用户模式**：纯本地单用户设计，**无登录注册系统**，所有数据由当前设备的唯一用户使用。多人共用同一台设备时数据不分隔。（未来计划支持多用户。）