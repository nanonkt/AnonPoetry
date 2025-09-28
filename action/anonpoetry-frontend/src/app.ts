import { ethers } from "ethers";
import { MockFhevmInstance } from "@fhevm/mock-utils";
import { ABI as CONTRACT_ABI, ADDR as CONTRACT_ADDRESS } from "@/abi/AnonPoetry";

const RPC_URL = "http://127.0.0.1:8545";

let fhevmInstance: any;
let provider: ethers.JsonRpcProvider;
let signer: ethers.Signer;
let contract: ethers.Contract;
let walletProvider: any;
type DecryptSig = {
  publicKey: string;
  privateKey: string;
  signature: string;
  startTimestamp: number;
  durationDays: number;
  userAddress: string;
};
let decryptSig: DecryptSig | null = null;

async function initApp() {
  setStatus("fhevm", "loading", "Initializing...");

  provider = new ethers.JsonRpcProvider(RPC_URL);

  const metadata = await provider.send("fhevm_relayer_metadata", []);
  fhevmInstance = await MockFhevmInstance.create(provider, provider, {
    aclContractAddress: metadata.ACLAddress,
    inputVerifierContractAddress: metadata.InputVerifierAddress,
    kmsContractAddress: metadata.KMSVerifierAddress,
    chainId: Number((await provider.getNetwork()).chainId),
    gatewayChainId: 55815,
    verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
    verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
  });

  setStatus("fhevm", "ready", "Connected");

  const accounts = await provider.listAccounts();
  signer = accounts.length > 0 ? await provider.getSigner(accounts[0]!.address) : await provider.getSigner();
  contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

  const totalPoems = await contract.totalPoems();
  document.getElementById("totalPoems")!.textContent = totalPoems.toString();
  setStatus("contract", "ready", "Connected");

  if (window.ethereum) {
    walletProvider = window.ethereum;
    walletProvider.on?.("accountsChanged", handleAccountsChanged);
    walletProvider.on?.("chainChanged", () => window.location.reload());
  }

  (window as any).connectWallet = connectWallet;
  (window as any).publishPoem = publishPoem;
  (window as any).refreshPoems = refreshPoems;
  (window as any).decryptPoem = decryptPoem;
  (window as any).likePoem = likePoem;
  (window as any).generateRanking = generateRanking;
  setupTabs();
  await loadPoems();
}

function setStatus(kind: string, cls: string, text: string) {
  const dot = document.getElementById(`${kind}Status`)!;
  const label = document.getElementById(`${kind}StatusText`)!;
  dot.className = `status-dot ${cls}`;
  label.textContent = text;
}

async function connectWallet() {
  if (!window.ethereum) return alert("未检测到 MetaMask");
  try {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a69" }] });
    } catch (e: any) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: "0x7a69", chainName: "Hardhat", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: [RPC_URL] }],
        });
      } else {
        throw e;
      }
    }
    const accs: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
    const web3 = new ethers.BrowserProvider(window.ethereum);
    signer = await web3.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    document.getElementById("walletLabel")!.textContent = `Wallet: ${accs[0]!.slice(0, 6)}...${accs[0]!.slice(-4)}`;
    (document.getElementById("connectBtn") as HTMLButtonElement).textContent = "Connected";
  } catch (e: any) {
    alert(`Connect failed: ${e.message}`);
  }
}

function handleAccountsChanged(accs: string[]) {
  const label = document.getElementById("walletLabel")!;
  const btn = document.getElementById("connectBtn") as HTMLButtonElement;
  if (!accs || accs.length === 0) {
    label.textContent = "Wallet: Disconnected";
    btn.textContent = "🔗 Connect";
  } else {
    label.textContent = `Wallet: ${accs[0]!.slice(0, 6)}...${accs[0]!.slice(-4)}`;
  }
}

function showMessage(id: string, message: string, kind: "info" | "error" | "success") {
  const el = document.getElementById(id)!;
  const cls = kind === "error" ? "error-message" : kind === "success" ? "success-message" : "info-message";
  el.innerHTML = `<div class="${cls}">${message}</div>`;
  setTimeout(() => (el.innerHTML = ""), 3000);
}

function encodeStringToChunks(str: string): bigint[] {
  const enc = new TextEncoder();
  const bytes = enc.encode(str);
  const res: bigint[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, Math.min(i + 16, bytes.length));
    let val = 0n;
    for (let j = 0; j < slice.length; j++) val = (val << 8n) | BigInt(slice[j]!);
    res.push(val);
  }
  return res;
}

function decodeChunksToString(chunks: bigint[]): string {
  const bytes: number[] = [];
  for (const chunk of chunks) {
    let v = BigInt(chunk);
    const buf: number[] = [];
    for (let k = 0; k < 16; k++) {
      buf.push(Number(v & 0xffn));
      v >>= 8n;
    }
    bytes.push(...buf.reverse());
  }
  while (bytes.length && bytes[bytes.length - 1] === 0) bytes.pop();
  return new TextDecoder().decode(new Uint8Array(bytes));
}

async function publishPoem() {
  const title = (document.getElementById("poemTitle") as HTMLInputElement).value.trim();
  const body = (document.getElementById("poemBody") as HTMLTextAreaElement).value.trim();
  const btn = document.getElementById("publishBtn") as HTMLButtonElement;
  if (!title || !body) return showMessage("publishMessage", "请填写标题和正文", "error");
  try {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>发布中...';
    const titleChunks = encodeStringToChunks(title);
    const bodyChunks = encodeStringToChunks(body);
    const user = await signer.getAddress();
    const inputT = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, user);
    titleChunks.forEach((c) => inputT.add128(c));
    const encT = await inputT.encrypt();
    const inputB = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, user);
    bodyChunks.forEach((c) => inputB.add128(c));
    const encB = await inputB.encrypt();
    const tx = await contract.publishPoem(encT.handles, encT.inputProof, encB.handles, encB.inputProof);
    await tx.wait();
    showMessage("publishMessage", "发布成功！", "success");
    (document.getElementById("poemTitle") as HTMLInputElement).value = "";
    (document.getElementById("poemBody") as HTMLTextAreaElement).value = "";
    await loadPoems();
    const total = await contract.totalPoems();
    document.getElementById("totalPoems")!.textContent = total.toString();
  } catch (e: any) {
    showMessage("publishMessage", `发布失败: ${e.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "📝 发布作品";
  }
}

type PoemItem = { id: number; timestamp: number; title?: string; body?: string; likes?: number | null; decrypted?: boolean };
let poems: PoemItem[] = [];

async function loadPoems() {
  const total: bigint = await contract.totalPoems();
  const n = Number(total);
  poems = [];
  const count = Math.min(10, n);
  for (let i = n - count; i < n; i++) {
    const meta = await contract.getPoemMeta(i);
    poems.unshift({ id: Number(meta[0]), timestamp: Number(meta[1]), likes: null, decrypted: false });
  }
  renderPoems();
}

function renderPoems() {
  const list = document.getElementById("poemsList")!;
  if (poems.length === 0) return (list.innerHTML = '<div class="loading">暂无诗歌作品</div>');
  list.innerHTML = poems
    .map(
      (p) => `
      <div class="poem-card" data-id="${p.id}">
        <div class="poem-meta">
          <span>匿名作者</span>
          <span>${new Date(p.timestamp * 1000).toLocaleString()}</span>
          <span class="like-count">❤️ ${p.likes != null ? p.likes : "(加密)"}</span>
        </div>
        <div class="poem-content">
          ${p.decrypted ? `<div class="poem-title">${p.title}</div><div class="poem-body">${p.body}</div>` : `<div class="poem-title">🔒 加密作品 #${p.id}</div><div class="poem-body">点击解密查看内容...</div>`}
        </div>
        <div class="poem-actions">
          <button class="btn btn-small btn-outline" onclick="likePoem(${p.id})">❤️ 点赞</button>
          ${!p.decrypted ? `<button class="btn btn-small" onclick="decryptPoem(${p.id})">🔓 解密查看</button>` : ""}
        </div>
      </div>`
    )
    .join("");
}

async function decryptPoem(id: number) {
  // 先在链上为当前用户授予解密权限
  try {
    console.log(`正在为作品 ${id} 授予解密权限...`);
    const userAddress = await signer.getAddress();
    console.log(`用户地址: ${userAddress}`);
    const txGrant = await contract.grantReadForCaller(id);
    console.log(`权限授予交易已发送: ${txGrant.hash}`);
    await txGrant.wait();
    console.log(`权限授予交易已确认`);
  } catch (e: any) {
    console.error(`权限授予失败:`, e);
    showMessage("publishMessage", `权限授予失败: ${e.message}`, "error");
    return;
  }
  const tCount: bigint = await contract.getTitleChunkCount(id);
  const bCount: bigint = await contract.getBodyChunkCount(id);
  const titleHandles: string[] = [];
  for (let i = 0; i < Number(tCount); i++) {
    titleHandles.push(await contract.getTitleChunk(id, i));
  }
  const bodyHandles: string[] = [];
  for (let i = 0; i < Number(bCount); i++) {
    bodyHandles.push(await contract.getBodyChunk(id, i));
  }

  console.log(`开始解密标题，句柄数量: ${titleHandles.length}`);
  console.log(`标题句柄:`, titleHandles);
  const valuesTitle = await userDecryptMany(titleHandles);
  console.log(`标题解密成功`);
  
  console.log(`开始解密正文，句柄数量: ${bodyHandles.length}`);
  console.log(`正文句柄:`, bodyHandles);
  const valuesBody = await userDecryptMany(bodyHandles);
  console.log(`正文解密成功`);
  const t: bigint[] = titleHandles.map((h) => valuesTitle[h]);
  const b: bigint[] = bodyHandles.map((h) => valuesBody[h]);
  const poem = poems.find((p) => p.id === id)!;
  poem.title = decodeChunksToString(t);
  poem.body = decodeChunksToString(b);
  poem.decrypted = true;
  try {
    const encLikes = await contract.getLikes(id);
    const likeVal = await userDecryptMany([encLikes as unknown as string]);
    poem.likes = Number(Object.values(likeVal)[0] as bigint);
  } catch {}
  renderPoems();
}

async function likePoem(id: number) {
  try {
    console.log(`正在为作品 ${id} 点赞...`);
    const user = await signer.getAddress();
    const input = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, user);
    input.add32(1);
    const enc = await input.encrypt();
    const tx = await contract.like(id, enc.handles[0], enc.inputProof);
    await tx.wait();
    console.log(`点赞交易已确认`);
    
    // 先授予解密权限，然后解密点赞数
    try {
      const txGrant = await contract.grantReadForCaller(id);
      await txGrant.wait();
      console.log(`点赞数解密权限已授予`);
    } catch (e) {
      console.log(`权限可能已存在，继续解密`);
    }
    
    const encLikes = await contract.getLikes(id);
    const dec = await userDecryptMany([encLikes as unknown as string]);
    const poem = poems.find((p) => p.id === id)!;
    poem.likes = Number(Object.values(dec)[0] as bigint);
    console.log(`点赞数已更新: ${poem.likes}`);
    renderPoems();
  } catch (e: any) {
    console.error(`点赞失败:`, e);
    showMessage("publishMessage", `点赞失败: ${e.message}`, "error");
  }
}

async function refreshPoems() {
  await loadPoems();
}

async function generateRanking() {
  const cont = document.getElementById("rankingList")!;
  cont.innerHTML = '<div class="loading"><div class="spinner"></div>生成排行榜中...</div>';
  const rows: { id: number; likes: number; ts: number; title: string; decrypted: boolean }[] = [];
  for (const p of poems) {
    let likes = 0;
    try {
      // 先授予解密权限
      try {
        const txGrant = await contract.grantReadForCaller(p.id);
        await txGrant.wait();
      } catch (e) {
        // 权限可能已存在
      }
      
      const enc = await contract.getLikes(p.id);
      const dec = await userDecryptMany([enc as unknown as string]);
      likes = Number(Object.values(dec)[0] as bigint);
      console.log(`作品 ${p.id} 点赞数: ${likes}`);
    } catch (e) {
      console.error(`获取作品 ${p.id} 点赞数失败:`, e);
    }
    rows.push({ id: p.id, likes, ts: p.timestamp, title: p.title || `作品 #${p.id}`, decrypted: !!p.decrypted });
  }
  rows.sort((a, b) => (b.likes !== a.likes ? b.likes - a.likes : b.ts - a.ts));
  cont.innerHTML = rows
    .slice(0, 10)
    .map(
      (r, i) => `
      <div class="ranking-item">
        <div class="ranking-number">${i + 1}</div>
        <div class="ranking-content">
          <div style="font-weight:600;margin-bottom:5px;">${r.decrypted ? r.title : `🔒 加密作品 #${r.id}`}</div>
          <div style="font-size:0.9rem;color:#7f8c8d;">❤️ ${r.likes} 个赞 · ${new Date(r.ts * 1000).toLocaleString()}</div>
        </div>
      </div>`
    )
    .join("");
}

initApp();

// ---------------------- Tabs ----------------------
function setupTabs() {
  const tabs = document.querySelectorAll<HTMLDivElement>(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab") as "publish" | "browse" | "ranking";
      setActiveTab(target);
      if (target === "browse") refreshPoems();
      if (target === "ranking") generateRanking();
    });
  });
}


// ---------------------- User Decrypt with EIP-712 ----------------------
async function ensureDecryptSignature(): Promise<DecryptSig> {
  if (decryptSig && Date.now() / 1000 < decryptSig.startTimestamp + decryptSig.durationDays * 24 * 60 * 60) return decryptSig;
  const user = await signer.getAddress();
  const { publicKey, privateKey } = fhevmInstance.generateKeypair();
  const start = Math.floor(Date.now() / 1000);
  const durationDays = 365;
  const eip712 = fhevmInstance.createEIP712(publicKey, [CONTRACT_ADDRESS], start, durationDays);
  const signature = await (signer as ethers.Signer).signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message
  );
  decryptSig = { publicKey, privateKey, signature, startTimestamp: start, durationDays, userAddress: user };
  return decryptSig;
}

async function userDecryptMany(handles: string[]): Promise<Record<string, bigint>> {
  const sig = await ensureDecryptSignature();
  console.log(`解密签名用户地址: ${sig.userAddress}`);
  console.log(`当前signer地址: ${await signer.getAddress()}`);
  const req = handles.map((h) => ({ handle: h, contractAddress: CONTRACT_ADDRESS }));
  const res = await fhevmInstance.userDecrypt(
    req,
    sig.privateKey,
    sig.publicKey,
    sig.signature,
    [CONTRACT_ADDRESS],
    sig.userAddress,
    sig.startTimestamp,
    sig.durationDays
  );
  return res as Record<string, bigint>;
}
function setActiveTab(name: "publish" | "browse" | "ranking") {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelector(`.tab[data-tab='${name}']`)?.classList.add("active");

  const ids = ["publishTab", "browseTab", "rankingTab"];
  ids.forEach((id) => document.getElementById(id)?.classList.add("hidden"));
  const map: Record<typeof name, string> = {
    publish: "publishTab",
    browse: "browseTab",
    ranking: "rankingTab",
  } as const;
  document.getElementById(map[name])?.classList.remove("hidden");
}


