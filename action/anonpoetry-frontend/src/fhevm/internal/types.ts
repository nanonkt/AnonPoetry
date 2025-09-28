import type { ethers } from "ethers";

export type FhevmInstance = {
  createEncryptedInput: (
    contractAddress: string,
    userAddress: string
  ) => {
    add32: (v: number | bigint) => void;
    add64: (v: number | bigint) => void;
    add128: (v: bigint) => void;
    add256: (v: bigint) => void;
    addBool: (v: boolean) => void;
    encrypt: () => Promise<{ handles: string[]; inputProof: string }>;
  };
  decrypt: (contractAddress: string, handle: string) => Promise<bigint>;
};




