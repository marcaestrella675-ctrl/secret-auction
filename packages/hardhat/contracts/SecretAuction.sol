// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SecretAuction
 * @notice A privacy-preserving auction contract using Fully Homomorphic Encryption (FHE)
 * @dev Users submit encrypted bids and compare against a secret reserve price
 * 
 * Key Features:
 * - Bids remain encrypted on-chain
 * - Reserve price is hidden from users
 * - Only the bidder can decrypt their result
 * - No one (including contract owner) can see actual bid amounts
 */
contract SecretAuction is ZamaEthereumConfig {
    // ==================== State Variables ====================
    
    /// @notice Encrypted reserve price for the auction
    /// @dev Set in constructor, only contract and authorized users can decrypt
    euint32 private reservePrice;
    
    /// @notice Mapping of user addresses to their encrypted bid results (1 = success, 0 = failure)
    mapping(address => euint32) public bidResults;
    
    /// @notice Mapping to track if a user has submitted a bid
    mapping(address => bool) public hasBid;
    
    /// @notice Timestamp when each user submitted their bid
    mapping(address => uint256) public bidTimestamp;
    
    // ==================== Events ====================
    
    /// @notice Emitted when a user submits a bid
    /// @param bidder Address of the bidder
    /// @param timestamp Time when bid was submitted
    event BidSubmitted(address indexed bidder, uint256 timestamp);
    
    // ==================== Constructor ====================
    
    /**
     * @notice Initialize the auction with a secret reserve price
     * @dev Reserve price is encrypted and only accessible by contract
     * Reserve price is set to 1000 (can be any uint32 value)
     */
    constructor() {
        // Set reserve price to 1000 (encrypted)
        reservePrice = FHE.asEuint32(uint32(1000));
        
        // Grant contract access to reserve price
        FHE.allowThis(reservePrice);
    }
    
    // ==================== Core Functions ====================
    
    /**
     * @notice Submit an encrypted bid to the auction
     * @dev Compares bid against reserve price using FHE operations
     * 
     * @param encryptedBid The encrypted bid amount (euint32)
     * @param proof Zero-knowledge proof for input verification
     * 
     * Flow:
     * 1. Verify and convert external encrypted input
     * 2. Compare bid >= reservePrice using FHE.gte()
     * 3. Store encrypted result (1 if successful, 0 if failed)
     * 4. Grant permissions for contract and user to access result
     */
    function submitBid(
        externalEuint32 encryptedBid,
        bytes calldata proof
    ) external {
        // Step 1: Convert external encrypted input to internal type
        euint32 bid = FHE.fromExternal(encryptedBid, proof);
        
        // Step 2: Compare bid >= reservePrice (encrypted comparison)
        // Using gt OR eq to implement gte (greater than or equal)
        ebool isGreater = FHE.gt(bid, reservePrice);
        ebool isEqual = FHE.eq(bid, reservePrice);
        ebool isSuccess = FHE.or(isGreater, isEqual);
        
        // Step 3: Convert boolean result to euint32 (1 = success, 0 = failure)
        euint32 one = FHE.asEuint32(uint32(1));
        euint32 zero = FHE.asEuint32(uint32(0));
        euint32 result = FHE.select(isSuccess, one, zero);
        
        // Step 4: Store encrypted result
        bidResults[msg.sender] = result;
        hasBid[msg.sender] = true;
        bidTimestamp[msg.sender] = block.timestamp;
        
        // Step 5: CRITICAL - Dual permission grant
        FHE.allowThis(result);         // Contract can return handle
        FHE.allow(result, msg.sender); // User can decrypt result
        
        emit BidSubmitted(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Get your encrypted bid result
     * @dev Returns encrypted handle that can be decrypted by the bidder
     * 
     * @return bytes32 Encrypted handle to the result
     * 
     * Requirements:
     * - Caller must have submitted a bid
     */
    function getMyResult() external view returns (bytes32) {
        require(hasBid[msg.sender], "No bid submitted");
        return FHE.toBytes32(bidResults[msg.sender]);
    }
    
    /**
     * @notice Check if a user has submitted a bid
     * @param user Address to check
     * @return bool True if user has submitted a bid
     */
    function hasUserBid(address user) external view returns (bool) {
        return hasBid[user];
    }
    
    /**
     * @notice Get the timestamp of when a user submitted their bid
     * @param user Address to query
     * @return uint256 Timestamp of bid submission
     */
    function getBidTimestamp(address user) external view returns (uint256) {
        require(hasBid[user], "No bid submitted");
        return bidTimestamp[user];
    }
}

