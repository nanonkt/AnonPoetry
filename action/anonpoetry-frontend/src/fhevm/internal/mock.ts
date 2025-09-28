import { JsonRpcProvider } from "ethers";
import { MockFhevmInstance } from "@fhevm/mock-utils";
import { FhevmInstance } from "./types";

export async function createMockInstance(rpcUrl: string): Promise<FhevmInstance> {
  const provider = new JsonRpcProvider(rpcUrl);
  const metadata = await provider.send("fhevm_relayer_metadata", []);
  const instance = await MockFhevmInstance.create(provider, provider, {
    aclContractAddress: metadata.ACLAddress,
    inputVerifierContractAddress: metadata.InputVerifierAddress,
    kmsContractAddress: metadata.KMSVerifierAddress,
    chainId: (await provider.getNetwork()).chainId,
    gatewayChainId: 55815,
    verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
    verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
  });
  return instance as unknown as FhevmInstance;
}




