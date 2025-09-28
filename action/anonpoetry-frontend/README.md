# AnonPoetry Frontend

基于 React + Vite 的前端，使用本地 FHEVM Mock 实例（@fhevm/mock-utils）与合约交互。

## 安装
```bash
cd action/anonpoetry-frontend
npm install
```

## 生成 ABI/地址
```bash
# 先在 action/anonpoetry-hardhat 已部署到 localhost 后执行
npm run genabi
```

## 启动开发
```bash
npm run dev
```

打开 `http://localhost:5173`，将 RPC 指向 `http://127.0.0.1:8545`。

- 发布：输入标题与正文，前端会分片加密后上链。
- 列表：展示最近 10 篇；支持点赞与解密查看。
- 排行榜：尝试解密点赞数并排序展示。


