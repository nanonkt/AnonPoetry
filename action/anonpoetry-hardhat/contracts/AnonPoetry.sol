// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { FHE, euint32, euint64, euint128, euint256, ebool, 
  externalEuint32, externalEuint64, externalEuint128, externalEuint256, externalEbool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title AnonPoetry - 匿名诗歌发布平台（FHEVM）
/// @notice 存储加密的标题/正文与加密点赞计数；明文仅保留时间戳与ID，作者保持匿名
contract AnonPoetry is SepoliaConfig {

  /// 采用分片策略保存字符串内容（前端负责把字符串编码为若干 uint128/uint256 块）
  struct Poem {
    // 标题分片（加密）
    euint128[] titleChunks;
    // 正文分片（加密）
    euint128[] bodyChunks;
    // 点赞数（加密）
    euint32 likes;
    // 发布时间（明文）
    uint256 timestamp;
    // Poem ID（明文）
    uint256 id;
  }

  /// poemId => Poem
  mapping(uint256 => Poem) private poems;
  /// 总数
  uint256 public totalPoems;

  event PoemPublished(uint256 indexed poemId, uint256 timestamp);
  event PoemLiked(uint256 indexed poemId);
  event ReadGranted(uint256 indexed poemId, address indexed user);

  /// @dev 前端把字符串编码为 uint128 数组后，逐块提交。
  /// 每个 addXX 调用会携带统一的 inputProof；合约内从 external -> internal 并授权。
  function publishPoem(
    externalEuint128[] calldata titleEnc,
    bytes calldata titleProof,
    externalEuint128[] calldata bodyEnc,
    bytes calldata bodyProof
  ) external {
    uint256 poemId = totalPoems;

    // 初始化结构体
    Poem storage p = poems[poemId];
    p.timestamp = block.timestamp;
    p.id = poemId;

    // 标题分片导入
    uint256 tlen = titleEnc.length;
    p.titleChunks = new euint128[](tlen);
    for (uint256 i = 0; i < tlen; i++) {
      euint128 chunk = FHE.fromExternal(titleEnc[i], titleProof);
      p.titleChunks[i] = chunk;
      FHE.allowThis(chunk);
      FHE.allow(chunk, msg.sender);
    }

    // 正文分片导入
    uint256 blen = bodyEnc.length;
    p.bodyChunks = new euint128[](blen);
    for (uint256 i = 0; i < blen; i++) {
      euint128 chunk = FHE.fromExternal(bodyEnc[i], bodyProof);
      p.bodyChunks[i] = chunk;
      FHE.allowThis(chunk);
      FHE.allow(chunk, msg.sender);
    }

    // 初始化点赞（0）
    p.likes = FHE.asEuint32(0);
    FHE.allowThis(p.likes);
    FHE.allow(p.likes, msg.sender);

    totalPoems++;
    emit PoemPublished(poemId, p.timestamp);
  }

  /// @notice 加密点赞：前端提供 1（或任意正数）作为加密输入，合约内部累加
  function like(
    uint256 poemId,
    externalEuint32 encOne,
    bytes calldata proof
  ) external {
    require(poemId < totalPoems, "Invalid poem");
    Poem storage p = poems[poemId];

    euint32 one = FHE.fromExternal(encOne, proof);
    p.likes = FHE.add(p.likes, one);

    FHE.allowThis(p.likes);
    FHE.allow(p.likes, msg.sender);
    emit PoemLiked(poemId);
  }

  /// -------- 只读/查询接口（加密数据只可被授权者解密） --------

  function getPoemMeta(uint256 poemId) external view returns (uint256 id, uint256 timestamp) {
    require(poemId < totalPoems, "Invalid poem");
    Poem storage p = poems[poemId];
    return (p.id, p.timestamp);
  }

  function getTitleChunkCount(uint256 poemId) external view returns (uint256) {
    require(poemId < totalPoems, "Invalid poem");
    return poems[poemId].titleChunks.length;
  }

  function getBodyChunkCount(uint256 poemId) external view returns (uint256) {
    require(poemId < totalPoems, "Invalid poem");
    return poems[poemId].bodyChunks.length;
  }

  function getTitleChunk(uint256 poemId, uint256 index) external view returns (euint128) {
    require(poemId < totalPoems, "Invalid poem");
    require(index < poems[poemId].titleChunks.length, "bad index");
    return poems[poemId].titleChunks[index];
  }

  function getBodyChunk(uint256 poemId, uint256 index) external view returns (euint128) {
    require(poemId < totalPoems, "Invalid poem");
    require(index < poems[poemId].bodyChunks.length, "bad index");
    return poems[poemId].bodyChunks[index];
  }

  function getLikes(uint256 poemId) external view returns (euint32) {
    require(poemId < totalPoems, "Invalid poem");
    return poems[poemId].likes;
  }

  /// @notice Grant read access on-chain for msg.sender to decrypt this poem
  /// @dev Anyone can call; the contract (allowed via allowThis) re-grants to caller
  function grantReadForCaller(uint256 poemId) external {
    require(poemId < totalPoems, "Invalid poem");
    Poem storage p = poems[poemId];

    uint256 tlen = p.titleChunks.length;
    for (uint256 i = 0; i < tlen; i++) {
      FHE.allow(p.titleChunks[i], msg.sender);
    }

    uint256 blen = p.bodyChunks.length;
    for (uint256 j = 0; j < blen; j++) {
      FHE.allow(p.bodyChunks[j], msg.sender);
    }

    FHE.allow(p.likes, msg.sender);

    emit ReadGranted(poemId, msg.sender);
  }
}


