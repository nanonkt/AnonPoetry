import React, { useCallback, useMemo, useState } from "react";
import { ethers } from "ethers";
import type { FhevmInstance } from "@/fhevm/internal/types";
import { ABI, ADDR } from "@/abi/AnonPoetry";

function encodeStringToUint128Chunks(str: string): bigint[] {
  const enc = new TextEncoder();
  const bytes = enc.encode(str);
  const out: bigint[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, Math.min(i + 16, bytes.length));
    let val = 0n;
    for (let j = 0; j < slice.length; j++) {
      val = (val << 8n) | BigInt(slice[j]!);
    }
    out.push(val);
  }
  return out;
}

export function useAnonPoetry(params: {
  instance: FhevmInstance | undefined;
  chainId: number;
  rpcUrl: string;
}) {
  const provider = useMemo(() => new ethers.JsonRpcProvider(params.rpcUrl), [params.rpcUrl]);
  const signer = useMemo(() => provider.getSigner(), [provider]);
  const contract = useMemo(() => new ethers.Contract(ADDR, ABI, signer), [signer]);

  const [list, setList] = useState<{ id: number; timestamp: number }[]>([]);
  const [publishing, setPublishing] = useState(false);

  const refresh = useCallback(async () => {
    const total: bigint = await contract.totalPoems();
    const n = Number(total);
    const arr: { id: number; timestamp: number }[] = [];
    for (let i = Math.max(0, n - 10); i < n; i++) {
      const meta = await contract.getPoemMeta(i);
      arr.unshift({ id: Number(meta[0]), timestamp: Number(meta[1]) });
    }
    setList(arr);
  }, [contract]);

  const publish = useCallback(
    async (title: string, body: string) => {
      if (!params.instance) return;
      setPublishing(true);
      try {
        const titleChunks = encodeStringToUint128Chunks(title);
        const bodyChunks = encodeStringToUint128Chunks(body);

        const input = params.instance.createEncryptedInput(ADDR, (await signer).address);
        for (const t of titleChunks) input.add128(t);
        const encTitle = await input.encrypt();

        const input2 = params.instance.createEncryptedInput(ADDR, (await signer).address);
        for (const b of bodyChunks) input2.add128(b);
        const encBody = await input2.encrypt();

        const tx = await contract.publishPoem(encTitle.handles, encTitle.inputProof, encBody.handles, encBody.inputProof);
        await tx.wait();
        await refresh();
      } finally {
        setPublishing(false);
      }
    },
    [params.instance, contract, signer, refresh]
  );

  const like = useCallback(
    async (id: number) => {
      if (!params.instance) return;
      const input = params.instance.createEncryptedInput(ADDR, (await signer).address);
      input.add32(1);
      const enc = await input.encrypt();
      const tx = await contract.like(id, enc.handles[0], enc.inputProof);
      await tx.wait();
      await refresh();
    },
    [params.instance, contract, signer, refresh]
  );

  const Publish: React.FC = () => {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    return (
      <div style={{ marginBottom: 24 }}>
        <h3>发布诗歌</h3>
        <div>
          <input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 360 }} />
        </div>
        <div>
          <textarea placeholder="正文" value={body} onChange={(e) => setBody(e.target.value)} rows={6} cols={60} />
        </div>
        <button onClick={() => publish(title, body)} disabled={publishing || !params.instance}>发布</button>
      </div>
    );
  };

  const List: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [likes, setLikes] = useState<Record<number, string>>({});
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [texts, setTexts] = useState<Record<number, { title: string; body: string }>>({});

    const onRefresh = useCallback(async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    }, [refresh]);

    const tryDecrypt = useCallback(
      async (id: number) => {
        if (!params.instance) return;
        // 读取分片总数
        const tCount: bigint = await contract.getTitleChunkCount(id);
        const bCount: bigint = await contract.getBodyChunkCount(id);

        const decTitle: string[] = [];
        for (let i = 0; i < Number(tCount); i++) {
          const handle = await contract.getTitleChunk(id, i);
          const clear = await params.instance.decrypt(ADDR, handle);
          // 将 bigint 转回 bytes → string
          const bytes: number[] = [];
          let tmp = clear;
          const buf: number[] = [];
          for (let k = 0; k < 16; k++) {
            const b = Number(tmp & 0xffn);
            buf.push(b);
            tmp >>= 8n;
          }
          bytes.push(...buf.reverse());
          decTitle.push(new TextDecoder().decode(new Uint8Array(bytes)).replace(/\u0000+$/g, ""));
        }

        const decBody: string[] = [];
        for (let i = 0; i < Number(bCount); i++) {
          const handle = await contract.getBodyChunk(id, i);
          const clear = await params.instance.decrypt(ADDR, handle);
          const bytes: number[] = [];
          let tmp = clear;
          const buf: number[] = [];
          for (let k = 0; k < 16; k++) {
            const b = Number(tmp & 0xffn);
            buf.push(b);
            tmp >>= 8n;
          }
          bytes.push(...buf.reverse());
          decBody.push(new TextDecoder().decode(new Uint8Array(bytes)).replace(/\u0000+$/g, ""));
        }

        setTexts((prev) => ({ ...prev, [id]: { title: decTitle.join(""), body: decBody.join("") } }));
      },
      [params.instance, contract]
    );

    const onLike = useCallback(async (id: number) => {
      await like(id);
      // 刷新加密点赞展示（尝试解密）
      if (params.instance) {
        const enc = await contract.getLikes(id);
        const clear = await params.instance.decrypt(ADDR, enc);
        setLikes((prev) => ({ ...prev, [id]: clear.toString() }));
      }
    }, [like, contract, params.instance]);

    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <button onClick={onRefresh} disabled={loading}>刷新</button>
        </div>
        {list.map((p) => (
          <div key={p.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
            <div>
              <strong>匿名作品</strong> · {new Date(p.timestamp * 1000).toLocaleString()}
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => onLike(p.id)}>❤️ 点赞</button>
              <button style={{ marginLeft: 8 }} onClick={() => tryDecrypt(p.id)}>解密查看</button>
              <span style={{ marginLeft: 8 }}>点赞数：{likes[p.id] ?? "(加密)"}</span>
            </div>
            {texts[p.id] && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600 }}>{texts[p.id]!.title}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{texts[p.id]!.body}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const Ranking: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<{ id: number; likes: number; ts: number }[]>([]);

    const build = useCallback(async () => {
      setLoading(true);
      try {
        const res: { id: number; likes: number; ts: number }[] = [];
        for (const it of list) {
          let likeNum = -1;
          if (params.instance) {
            try {
              const enc = await contract.getLikes(it.id);
              const clear = await params.instance.decrypt(ADDR, enc);
              likeNum = Number(clear);
            } catch {}
          }
          res.push({ id: it.id, likes: likeNum, ts: it.timestamp });
        }
        res.sort((a, b) => {
          if (b.likes !== a.likes) return b.likes - a.likes; // 已解密的优先按点赞
          return b.ts - a.ts; // 否则按时间
        });
        setRows(res.slice(0, 10));
      } finally {
        setLoading(false);
      }
    }, [list, contract, params.instance]);

    return (
      <div style={{ marginTop: 24 }}>
        <h3>排行榜（Top 10）</h3>
        <button onClick={build} disabled={loading}>生成排行榜</button>
        <ol>
          {rows.map((r) => (
            <li key={r.id}>
              #{r.id} · 点赞：{r.likes >= 0 ? r.likes : "(加密)"} · 时间：{new Date(r.ts * 1000).toLocaleString()}
            </li>
          ))}
        </ol>
      </div>
    );
  };

  return { Publish, List, Ranking } as const;
}


