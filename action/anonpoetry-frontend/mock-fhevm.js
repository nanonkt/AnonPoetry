// 简化的 FHEVM Mock 实现，用于演示
export class MockFhevmInstance {
    constructor(provider, metadata) {
        this.provider = provider;
        this.metadata = metadata;
        this.contractAddress = '';
        this.userAddress = '';
    }

    static async create(provider, signer, config) {
        const instance = new MockFhevmInstance(provider, config);
        return instance;
    }

    createEncryptedInput(contractAddress, userAddress) {
        this.contractAddress = contractAddress;
        this.userAddress = userAddress;
        
        const values = [];
        
        return {
            add32: (value) => {
                values.push({ type: 'uint32', value: BigInt(value) });
            },
            add64: (value) => {
                values.push({ type: 'uint64', value: BigInt(value) });
            },
            add128: (value) => {
                values.push({ type: 'uint128', value: BigInt(value) });
            },
            addBool: (value) => {
                values.push({ type: 'bool', value: Boolean(value) });
            },
            encrypt: async () => {
                // 模拟加密过程，生成假的句柄和证明
                const handles = values.map((_, index) => {
                    // 生成伪随机的 32 字节句柄
                    const handle = '0x' + Array.from({length: 64}, () => 
                        Math.floor(Math.random() * 16).toString(16)
                    ).join('');
                    return handle;
                });
                
                // 生成假的证明数据
                const inputProof = '0x' + Array.from({length: 128}, () => 
                    Math.floor(Math.random() * 16).toString(16)
                ).join('');
                
                // 存储值以便后续解密
                handles.forEach((handle, index) => {
                    this.storeValue(handle, values[index].value);
                });
                
                return {
                    handles,
                    inputProof
                };
            }
        };
    }

    async decrypt(contractAddress, handle) {
        // 从存储中获取值
        const value = this.getValue(handle);
        if (value !== undefined) {
            return value;
        }
        
        // 如果没有找到存储的值，返回随机值作为演示
        return BigInt(Math.floor(Math.random() * 100));
    }

    // 简单的内存存储
    storeValue(handle, value) {
        if (!window.mockFhevmStorage) {
            window.mockFhevmStorage = new Map();
        }
        window.mockFhevmStorage.set(handle, value);
    }

    getValue(handle) {
        if (!window.mockFhevmStorage) {
            return undefined;
        }
        return window.mockFhevmStorage.get(handle);
    }
}


