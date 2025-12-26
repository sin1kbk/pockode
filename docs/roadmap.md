# Pockode MVP Roadmap

## 概述

**目标**：构建可自用的移动端 AI 编程平台 MVP
**核心理念**：AI 编辑为主，手动编辑为辅

### MVP 范围

| 项目 | 决策 |
|------|------|
| 目标用户 | 仅自己使用，快速验证概念 |
| AI 代理 | 仅 Claude CLI |
| 功能 | 对话式编码 + 手动编辑器 + Git diff 查看 |
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

## 阶段 1：核心对话功能

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

## 阶段 2：多 Session 支持

**目标**：支持多个独立对话，为后续 REST API 提供 Session 基础

### 后端

- [x] Session 管理（创建、列表、切换、删除）
- [x] Session 与 Claude 进程绑定
- [ ] Session 消息持久化

### 前端

- [x] Session 列表侧边栏
- [x] 新建/切换/删除 Session
- [x] 当前 Session 状态显示

### 交付物

- [x] 可创建多个独立对话
- [ ] 切换 Session 时恢复历史消息

---

## 阶段 3：文件与编辑

**目标**：支持文件浏览、手动编辑和 Git 操作

### 后端

- [ ] 文件 REST API（`GET/PUT/DELETE /api/fs/*path`）
- [ ] Git diff API（`GET /api/git/diff`）

### 前端

- [ ] 文件浏览器（树形结构）
- [ ] 代码编辑器（语法高亮）
- [ ] Git diff 查看器

### 交付物

- 浏览和编辑文件
- 查看工作区 Git diff

---

## 阶段 4：通信层稳定性

**目标**：提升移动端网络不稳定场景下的可靠性

### 架构重构：REST + WebSocket

采用 REST + WebSocket 混合模式，关键操作使用 REST 确保可靠性：

| 操作 | 方式 | 理由 |
|------|------|------|
| 发送消息 | POST /api/sessions/:id/messages | HTTP 可靠、可重试 |
| 取消生成 | POST /api/sessions/:id/cancel | 不依赖 WebSocket 连接 |
| 权限响应 | POST /api/permissions/:id | 不依赖 WebSocket 连接 |
| 获取历史 | GET /api/sessions/:id/messages | 重连后恢复上下文 |
| 流式响应 | WebSocket | 双向通信、低延迟 |

### 后端

- [ ] REST API：消息发送、权限响应、历史获取
- [ ] WebSocket 断线重连支持
- [ ] 消息序列号，支持断点续传（仅缓存当前回复）

### 前端

- [ ] 消息发送改用 fetch POST
- [ ] WebSocket 断线自动重连
- [ ] 重连后通过 REST 同步缺失消息

### 交付物

- 网络不稳定时消息不丢失
- 断线自动重连和恢复

---

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| AI 调用 | `--output-format stream-json` | 实时流式输出 + 工具调用详情 |
| 实时通信 | WebSocket + REST（阶段 4） | WebSocket 负责流式输出；REST 处理关键操作确保可靠性 |
| 文件存储 | 文件系统目录 | 简单，便于 Claude 操作 |

---

## 风险与对策

| 风险 | 对策 |
|------|------|
| Claude CLI 进程泄漏 | 超时自动终止 |
| 网络连接不稳定 | WebSocket 自动重连 + REST 历史恢复（阶段 4） |
| 路径遍历攻击 | 路径验证 |

---

## 后续扩展方向

- 多 AI 代理支持（Gemini、GPT）
- Git 操作 UI（commit、push、分支管理）
- Tool AskUserQuestion 支持（Claude 向用户提问的交互式 UI）
- system 消息展示重设计（改为 toast/banner 形式，不作为对话气泡）
- 空 assistant 消息的 UI 优化（发送失败时的显示方式）
