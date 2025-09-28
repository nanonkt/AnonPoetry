import { ethers } from 'https://esm.sh/ethers@6.7.1';

// 合约 ABI 和地址
const CONTRACT_ABI = [
  { "type": "function", "name": "totalPoems", "stateMutability": "view", "inputs": [], "outputs": [{"name":"","type":"uint256"}] },
  { "type": "function", "name": "publishPoem", "stateMutability": "nonpayable", "inputs": [
      {"name":"titleEnc","type":"bytes32[]"},
      {"name":"titleProof","type":"bytes"},
      {"name":"bodyEnc","type":"bytes32[]"},
      {"name":"bodyProof","type":"bytes"}
    ], "outputs": [] },
  { "type": "function", "name": "getPoemMeta", "stateMutability": "view", "inputs": [{"name":"poemId","type":"uint256"}], "outputs": [
      {"name":"id","type":"uint256"}, {"name":"timestamp","type":"uint256"}
    ] },
  { "type": "function", "name": "getTitleChunkCount", "stateMutability": "view", "inputs": [{"name":"poemId","type":"uint256"}], "outputs": [{"name":"","type":"uint256"}] },
  { "type": "function", "name": "getBodyChunkCount", "stateMutability": "view", "inputs": [{"name":"poemId","type":"uint256"}], "outputs": [{"name":"","type":"uint256"}] },
  { "type": "function", "name": "getTitleChunk", "stateMutability": "view", "inputs": [{"name":"poemId","type":"uint256"},{"name":"index","type":"uint256"}], "outputs": [{"name":"","type":"bytes32"}] },
  { "type": "function", "name": "getBodyChunk", "stateMutability": "view", "inputs": [{"name":"poemId","type":"uint256"},{"name":"index","type":"uint256"}], "outputs": [{"name":"","type":"bytes32"}] },
  { "type": "function", "name": "getLikes", "stateMutability": "view", "inputs": [{"name":"poemId","type":"uint256"}], "outputs": [{"name":"","type":"bytes32"}] },
  { "type": "function", "name": "like", "stateMutability": "nonpayable", "inputs": [
      {"name":"poemId","type":"uint256"},
      {"name":"encOne","type":"bytes32"},
      {"name":"proof","type":"bytes"}
    ], "outputs": [] }
];

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const RPC_URL = "http://127.0.0.1:8545";

// 全局状态
let fhevmInstance = null;
let provider = null;
let signer = null;
let walletProvider = null; // window.ethereum
let contract = null;
let poems = [];

// 初始化应用
async function initApp() {
    try {
        updateStatus('fhevm', 'loading', '初始化中...');
        
        // 初始化 ethers provider（本地 RPC）
        provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // 检查是否为 FHEVM Hardhat 节点
        const metadata = await provider.send("fhevm_relayer_metadata", []);
        
        // 导入本地的 MockFhevmInstance
        const { MockFhevmInstance } = await import('./mock-fhevm.js');
        
        // 创建 FHEVM 实例
        fhevmInstance = await MockFhevmInstance.create(provider, provider, {
            aclContractAddress: metadata.ACLAddress,
            inputVerifierContractAddress: metadata.InputVerifierAddress,
            kmsContractAddress: metadata.KMSVerifierAddress,
            chainId: Number((await provider.getNetwork()).chainId),
            gatewayChainId: 55815,
            verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
            verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
        });
        
        updateStatus('fhevm', 'ready', '已连接');
        
        // 初始化合约
        await initContract();

        // 若浏览器有 MetaMask，初始化监听
        if (window.ethereum) {
            walletProvider = window.ethereum;
            walletProvider.on?.('accountsChanged', handleAccountsChanged);
            walletProvider.on?.('chainChanged', handleChainChanged);
        }
        
    } catch (error) {
        console.error('初始化失败:', error);
        updateStatus('fhevm', 'error', '连接失败');
        showMessage('publishMessage', `初始化失败: ${error.message}`, 'error');
    }
}

// 初始化合约
async function initContract() {
    try {
        updateStatus('contract', 'loading', '连接中...');
        
        // 默认使用本地节点第一个账户作为 signer；连接钱包后会替换
        const accounts = await provider.listAccounts();
        signer = accounts.length > 0
            ? await provider.getSigner(accounts[0].address)
            : await provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        // 测试合约连接
        const totalPoems = await contract.totalPoems();
        document.getElementById('totalPoems').textContent = totalPoems.toString();
        
        updateStatus('contract', 'ready', '已连接');
        
        // 加载诗歌列表
        await loadPoems();
        
    } catch (error) {
        console.error('合约初始化失败:', error);
        updateStatus('contract', 'error', '连接失败');
        showMessage('publishMessage', `合约连接失败: ${error.message}`, 'error');
    }
}

// 更新状态显示
function updateStatus(type, status, text) {
    const statusDot = document.getElementById(`${type}Status`);
    const statusText = document.getElementById(`${type}StatusText`);
    
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
}

// 显示消息
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="${type}-message">${message}</div>`;
    
    // 3秒后自动清除消息
    setTimeout(() => {
        element.innerHTML = '';
    }, 3000);
}

// 连接钱包
window.connectWallet = async function () {
    if (!window.ethereum) {
        alert('未检测到 MetaMask，建议安装后再试');
        return;
    }
    try {
        // 切换/添加本地链 31337
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x7a69' }], // 31337
            });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x7a69',
                        chainName: 'Hardhat',
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: [RPC_URL],
                    }],
                });
            } else {
                throw switchErr;
            }
        }

        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        signer = await web3Provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        document.getElementById('walletLabel').textContent = `钱包: ${accs[0].slice(0,6)}...${accs[0].slice(-4)}`;
        document.getElementById('connectBtn').textContent = '已连接';

        // 刷新列表和总数
        const totalPoems = await contract.totalPoems();
        document.getElementById('totalPoems').textContent = totalPoems.toString();
        await loadPoems();
    } catch (e) {
        console.error('连接钱包失败:', e);
        alert(`连接钱包失败: ${e.message}`);
    }
}

function handleAccountsChanged(accounts) {
    if (!accounts || accounts.length === 0) {
        document.getElementById('walletLabel').textContent = '钱包: 未连接';
        document.getElementById('connectBtn').textContent = '🔗 连接钱包';
    } else {
        document.getElementById('walletLabel').textContent = `钱包: ${accounts[0].slice(0,6)}...${accounts[0].slice(-4)}`;
    }
}

function handleChainChanged(_chainId) {
    // 简单刷新
    window.location.reload();
}

// 字符串编码为 uint128 分片
function encodeStringToChunks(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const chunks = [];
    
    for (let i = 0; i < bytes.length; i += 16) {
        const slice = bytes.slice(i, Math.min(i + 16, bytes.length));
        let value = 0n;
        
        for (let j = 0; j < slice.length; j++) {
            value = (value << 8n) | BigInt(slice[j]);
        }
        
        chunks.push(value);
    }
    
    return chunks;
}

// 解码 uint128 分片为字符串
function decodeChunksToString(chunks) {
    const bytes = [];
    
    for (const chunk of chunks) {
        const chunkBytes = [];
        let value = BigInt(chunk);
        
        for (let i = 0; i < 16; i++) {
            const byte = Number(value & 0xffn);
            chunkBytes.unshift(byte);
            value >>= 8n;
        }
        
        bytes.push(...chunkBytes);
    }
    
    // 移除尾部的零字节
    while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
        bytes.pop();
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array(bytes));
}

// 发布诗歌
window.publishPoem = async function() {
    const title = document.getElementById('poemTitle').value.trim();
    const body = document.getElementById('poemBody').value.trim();
    const publishBtn = document.getElementById('publishBtn');
    
    if (!title || !body) {
        showMessage('publishMessage', '请填写标题和正文', 'error');
        return;
    }
    
    if (!fhevmInstance || !contract) {
        showMessage('publishMessage', 'FHEVM 或合约未初始化', 'error');
        return;
    }
    
    try {
        publishBtn.disabled = true;
        publishBtn.innerHTML = '<div class="spinner"></div>发布中...';
        
        // 编码字符串为分片
        const titleChunks = encodeStringToChunks(title);
        const bodyChunks = encodeStringToChunks(body);
        
        // 获取用户地址
        const userAddress = await signer.getAddress();
        
        // 创建标题加密输入
        const titleInput = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, userAddress);
        for (const chunk of titleChunks) {
            titleInput.add128(chunk);
        }
        const titleEnc = await titleInput.encrypt();
        
        // 创建正文加密输入
        const bodyInput = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, userAddress);
        for (const chunk of bodyChunks) {
            bodyInput.add128(chunk);
        }
        const bodyEnc = await bodyInput.encrypt();
        
        // 调用合约发布
        const tx = await contract.publishPoem(
            titleEnc.handles,
            titleEnc.inputProof,
            bodyEnc.handles,
            bodyEnc.inputProof
        );
        
        showMessage('publishMessage', '交易已提交，等待确认...', 'info');
        
        await tx.wait();
        
        showMessage('publishMessage', '诗歌发布成功！', 'success');
        
        // 清空表单
        document.getElementById('poemTitle').value = '';
        document.getElementById('poemBody').value = '';
        
        // 刷新诗歌列表
        await loadPoems();
        
        // 更新总数
        const totalPoems = await contract.totalPoems();
        document.getElementById('totalPoems').textContent = totalPoems.toString();
        
    } catch (error) {
        console.error('发布失败:', error);
        showMessage('publishMessage', `发布失败: ${error.message}`, 'error');
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '📝 发布作品';
    }
};

// 加载诗歌列表
async function loadPoems() {
    if (!contract) return;
    
    try {
        const total = await contract.totalPoems();
        const totalNum = Number(total);
        
        poems = [];
        
        // 加载最近10首诗歌的元信息
        const loadCount = Math.min(10, totalNum);
        for (let i = totalNum - loadCount; i < totalNum; i++) {
            const meta = await contract.getPoemMeta(i);
            poems.unshift({
                id: Number(meta[0]),
                timestamp: Number(meta[1]),
                title: null,
                body: null,
                likes: null,
                decrypted: false
            });
        }
        
        renderPoems();
        
    } catch (error) {
        console.error('加载诗歌失败:', error);
    }
}

// 渲染诗歌列表
function renderPoems() {
    const poemsList = document.getElementById('poemsList');
    
    if (poems.length === 0) {
        poemsList.innerHTML = '<div class="loading">暂无诗歌作品</div>';
        return;
    }
    
    poemsList.innerHTML = poems.map(poem => `
        <div class="poem-card" data-id="${poem.id}">
            <div class="poem-meta">
                <span>匿名作者</span>
                <span>${new Date(poem.timestamp * 1000).toLocaleString()}</span>
                <span class="like-count">
                    ❤️ ${poem.likes !== null ? poem.likes : '(加密)'}
                </span>
            </div>
            
            <div class="poem-content">
                ${poem.decrypted ? `
                    <div class="poem-title">${poem.title}</div>
                    <div class="poem-body">${poem.body}</div>
                ` : `
                    <div class="poem-title">🔒 加密作品 #${poem.id}</div>
                    <div class="poem-body">点击解密查看内容...</div>
                `}
            </div>
            
            <div class="poem-actions">
                <button class="btn btn-small btn-outline" onclick="likePoem(${poem.id})">
                    ❤️ 点赞
                </button>
                ${!poem.decrypted ? `
                    <button class="btn btn-small" onclick="decryptPoem(${poem.id})">
                        🔓 解密查看
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// 解密诗歌
window.decryptPoem = async function(poemId) {
    if (!fhevmInstance || !contract) return;
    
    try {
        const poem = poems.find(p => p.id === poemId);
        if (!poem || poem.decrypted) return;
        
        // 获取标题分片数量和内容
        const titleCount = await contract.getTitleChunkCount(poemId);
        const bodyCount = await contract.getBodyChunkCount(poemId);
        
        // 解密标题
        const titleChunks = [];
        for (let i = 0; i < Number(titleCount); i++) {
            const handle = await contract.getTitleChunk(poemId, i);
            const decrypted = await fhevmInstance.decrypt(CONTRACT_ADDRESS, handle);
            titleChunks.push(decrypted);
        }
        
        // 解密正文
        const bodyChunks = [];
        for (let i = 0; i < Number(bodyCount); i++) {
            const handle = await contract.getBodyChunk(poemId, i);
            const decrypted = await fhevmInstance.decrypt(CONTRACT_ADDRESS, handle);
            bodyChunks.push(decrypted);
        }
        
        // 解码为字符串
        poem.title = decodeChunksToString(titleChunks);
        poem.body = decodeChunksToString(bodyChunks);
        poem.decrypted = true;
        
        // 尝试解密点赞数
        try {
            const likesHandle = await contract.getLikes(poemId);
            const likesDecrypted = await fhevmInstance.decrypt(CONTRACT_ADDRESS, likesHandle);
            poem.likes = Number(likesDecrypted);
        } catch (error) {
            console.log('解密点赞数失败:', error);
        }
        
        renderPoems();
        
    } catch (error) {
        console.error('解密失败:', error);
        alert(`解密失败: ${error.message}`);
    }
};

// 点赞诗歌
window.likePoem = async function(poemId) {
    if (!fhevmInstance || !contract) return;
    
    try {
        const userAddress = await signer.getAddress();
        
        // 创建加密的 1
        const input = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, userAddress);
        input.add32(1);
        const enc = await input.encrypt();
        
        // 调用合约点赞
        const tx = await contract.like(poemId, enc.handles[0], enc.inputProof);
        await tx.wait();
        
        // 尝试更新点赞数显示
        const poem = poems.find(p => p.id === poemId);
        if (poem) {
            try {
                const likesHandle = await contract.getLikes(poemId);
                const likesDecrypted = await fhevmInstance.decrypt(CONTRACT_ADDRESS, likesHandle);
                poem.likes = Number(likesDecrypted);
                renderPoems();
            } catch (error) {
                console.log('更新点赞数失败:', error);
            }
        }
        
        alert('点赞成功！');
        
    } catch (error) {
        console.error('点赞失败:', error);
        alert(`点赞失败: ${error.message}`);
    }
};

// 刷新诗歌列表
window.refreshPoems = async function() {
    await loadPoems();
};

// 生成排行榜
window.generateRanking = async function() {
    const rankingList = document.getElementById('rankingList');
    rankingList.innerHTML = '<div class="loading"><div class="spinner"></div>生成排行榜中...</div>';
    
    try {
        // 为所有诗歌解密点赞数
        const rankingData = [];
        
        for (const poem of poems) {
            let likes = 0;
            try {
                const likesHandle = await contract.getLikes(poem.id);
                const likesDecrypted = await fhevmInstance.decrypt(CONTRACT_ADDRESS, likesHandle);
                likes = Number(likesDecrypted);
            } catch (error) {
                console.log(`解密诗歌 ${poem.id} 点赞数失败:`, error);
            }
            
            rankingData.push({
                id: poem.id,
                likes: likes,
                timestamp: poem.timestamp,
                title: poem.title || `作品 #${poem.id}`,
                decrypted: poem.decrypted
            });
        }
        
        // 按点赞数排序
        rankingData.sort((a, b) => {
            if (b.likes !== a.likes) return b.likes - a.likes;
            return b.timestamp - a.timestamp;
        });
        
        // 渲染排行榜
        rankingList.innerHTML = rankingData.slice(0, 10).map((poem, index) => `
            <div class="ranking-item">
                <div class="ranking-number">${index + 1}</div>
                <div class="ranking-content">
                    <div style="font-weight: 600; margin-bottom: 5px;">
                        ${poem.decrypted ? poem.title : `🔒 加密作品 #${poem.id}`}
                    </div>
                    <div style="font-size: 0.9rem; color: #7f8c8d;">
                        ❤️ ${poem.likes} 个赞 · ${new Date(poem.timestamp * 1000).toLocaleString()}
                    </div>
                </div>
            </div>
        `).join('');
        
        if (rankingData.length === 0) {
            rankingList.innerHTML = '<div class="loading">暂无排行数据</div>';
        }
        
    } catch (error) {
        console.error('生成排行榜失败:', error);
        rankingList.innerHTML = '<div class="error-message">生成排行榜失败</div>';
    }
};

// 标签页切换
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // 更新标签页状态
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // 显示对应内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`${targetTab}Tab`).classList.remove('hidden');
    });
});

// 初始化应用
initApp();
