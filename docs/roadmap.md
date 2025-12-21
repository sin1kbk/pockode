# Pockode MVP Roadmap

## 概述

**目标**：构建可自用的移动端 AI 编程平台 MVP
**核心理念**：AI 编辑为主，手动编辑为辅

### MVP 范围

| 项目 | 决策 |
|------|------|
| 目标用户 | 仅自己使用，快速验证概念 |
| AI 代理 | 仅 Claude CLI |
| 功能 | 对话式编码 + 手动编辑器 + Git（通过对话） |
| 认证 | Header token 认证 |

---

## 阶段 0：项目骨架 + 认证

**目标**：建立可运行的前后端项目结构，含基础认证

### 前端

- [x] 初始化 Vite + React + TypeScript + Tailwind
- [x] 配置 Biome（替代 ESLint + Prettier）

### 后端

- [x] 初始化 Go module
- [x] 基础 HTTP 服务器 + Token 认证

### 交付物

- 前后端可运行，API 带认证

---

## 阶段 1：文件系统

**目标**：支持文件浏览和操作（为 AI 对话做准备）

### 后端

- [ ] 文件 REST API (`/api/fs/*path`)

### 前端

- [ ] 文件浏览器（可展开树形）

### 交付物

- 文件 CRUD 操作

---

## 阶段 2：核心对话功能

**目标**：实现 Chat 界面 + Claude CLI 集成

### 后端

- [x] Claude CLI 适配器（流式输出）
- [x] WebSocket 处理器

### 前端

- [x] Chat 组件
- [x] WebSocket 连接管理

### 交付物

- 可与 Claude CLI 对话，流式输出

---

## 阶段 3：手动编辑器

**目标**：完成代码编辑器

### 前端

- [ ] 代码编辑器组件
- [ ] 语法高亮

### 交付物

- 可编辑代码
- 语法高亮

---

## 阶段 4：多 Session 支持

**目标**：支持多个独立对话，为后续 REST API 提供 Session 基础

### 后端

- [ ] Session 管理（创建、列表、切换、删除）
- [ ] Session 与 Claude 进程绑定
- [ ] Session 消息持久化

### 前端

- [ ] Session 列表侧边栏
- [ ] 新建/切换/删除 Session
- [ ] 当前 Session 状态显示

### 交付物

- 可创建多个独立对话
- 切换 Session 时恢复历史消息

---

## 阶段 5：通信层稳定性

**目标**：提升移动端网络不稳定场景下的可靠性

### 架构重构：REST + SSE

将当前纯 WebSocket 架构改为 REST + SSE 混合模式：

| 操作 | 方式 | 理由 |
|------|------|------|
| 发送消息 | POST /api/sessions/:id/messages | HTTP 可靠、可重试 |
| 取消生成 | POST /api/sessions/:id/cancel | 不依赖 SSE 连接 |
| 权限响应 | POST /api/permissions/:id | 不依赖 SSE 连接 |
| 获取历史 | GET /api/sessions/:id/messages | 重连后恢复上下文 |
| 流式响应 | GET /api/sessions/:id/stream (SSE) | 浏览器自动重连 |

### 后端

- [ ] REST API：消息发送、权限响应、历史获取
- [ ] SSE 流式推送（替代 WebSocket）
- [ ] 支持 `Last-Event-ID` 断点续传（仅缓存当前回复）

### 前端

- [ ] EventSource 替代 WebSocket
- [ ] 消息发送改用 fetch POST
- [ ] 断线重连后自动同步缺失消息

### 交付物

- 网络不稳定时消息不丢失
- 断线自动重连和恢复

---

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| AI 调用 | `--output-format stream-json` | 实时流式输出 + 工具调用详情 |
| 实时通信 | WebSocket → SSE（阶段 5） | 当前用 WebSocket；阶段 5 改为 REST + SSE 提升稳定性 |
| 文件存储 | 文件系统目录 | 简单，便于 Claude 操作 |

---

## 风险与对策

| 风险 | 对策 |
|------|------|
| Claude CLI 进程泄漏 | 超时自动终止 |
| 网络连接不稳定 | SSE 自动重连 + REST 历史恢复（阶段 5） |
| 路径遍历攻击 | 路径验证 |

---

## 后续扩展方向

- 多 AI 代理支持（Gemini、GPT）
- Git 可视化 UI
