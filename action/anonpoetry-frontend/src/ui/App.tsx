import React, { useMemo, useState } from "react";
import { useFhevm } from "../fhevm/useFhevm";
import { useAnonPoetry } from "../hooks/useAnonPoetry";

export const App: React.FC = () => {
  const [rpcUrl, setRpcUrl] = useState("http://127.0.0.1:8545");
  const chainId = 31337;

  const { instance, status, error } = useFhevm({
    provider: rpcUrl,
    chainId,
    initialMockChains: { 31337: rpcUrl },
    enabled: true,
  });

  const poetry = useAnonPoetry({ instance, chainId, rpcUrl });

  return (
    <div style={{ padding: 24, fontFamily: "serif" }}>
      <h1>AnonPoetry</h1>

      <div style={{ marginBottom: 16 }}>
        <label>RPC: </label>
        <input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} style={{ width: 360 }} />
        <span style={{ marginLeft: 12 }}>status: {status}</span>
        {error && <span style={{ color: "red", marginLeft: 12 }}>{String(error)}</span>}
      </div>

      <poetry.Publish />
      <poetry.List />
      <poetry.Ranking />
    </div>
  );
};


