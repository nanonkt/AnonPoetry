# AnonPoetry Hardhat

本项目为 AnonPoetry 的合约工程，使用 FHEVM。

## 准备
- Node.js >= 20
- npm >= 7

## 安装
```bash
cd action/anonpoetry-hardhat
npm install
```

## 本地启动与部署
```bash
# 启动本地 FHEVM Hardhat 节点（窗口1）
npx hardhat node | cat

# 部署合约（窗口2）
cd action/anonpoetry-hardhat
npx hardhat deploy --network localhost | cat
```

如遇 “kmsVerifierContractAddress is not of type string, got undefined instead”，请检查 `fhevmTemp/precompiled-fhevm-core-contracts-addresses.json` 是否包含 `KMSVerifierAddress` 字段，必要时添加后重启节点并重新部署。

## 编译与测试
```bash
npm run compile
npm test
```


