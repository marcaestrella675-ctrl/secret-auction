# SecretAuction - Private Encrypted Auction Platform

A decentralized auction platform powered by **Zama's FHEVM v0.9** (Fully Homomorphic Encryption Virtual Machine), enabling truly private bidding where your bid amounts remain encrypted on-chain.

## 🎯 Overview

SecretAuction allows users to submit encrypted bids that are compared against a reserve price **without ever being decrypted**. Only you can decrypt your own result to see if you won - keeping all bid amounts completely private from other participants and even the contract owner.

## ✨ Key Features

- **🔐 Fully Encrypted Bids**: Bid amounts are encrypted using FHE before submission
- **🛡️ Complete Privacy**: No one can see your bid amount, not even the contract owner
- **⚡ On-Chain Computation**: Smart contracts compare encrypted values without decryption
- **🔓 Private Results**: Only you can decrypt your result (Won = 1, Lost = 0)
- **♻️ Reusable**: Submit multiple bids and try different amounts

## 🏗️ Technical Stack

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Wagmi & RainbowKit** - Wallet connection
- **ethers.js v6** - Ethereum interaction

### Smart Contracts
- **Solidity** - Smart contract language
- **Hardhat** - Development environment
- **FHEVM v0.9** - Fully homomorphic encryption

### Network
- **Sepolia Testnet** - Ethereum test network
- **Zama Relayer** - FHE decryption service

## 📦 Project Structure

```
zama-12/
├── packages/
│   ├── hardhat/              # Smart contracts
│   │   ├── contracts/        # Solidity contracts
│   │   ├── scripts/          # Deployment scripts
│   │   └── artifacts/        # Compiled contracts
│   └── nextjs-showcase/      # Frontend application
│       ├── app/              # Next.js app router
│       ├── components/       # React components
│       └── utils/            # Utility functions
└── pnpm-workspace.yaml       # Monorepo configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- MetaMask or compatible Web3 wallet
- Sepolia testnet ETH ([Get from faucet](https://sepoliafaucet.com/))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/marcaestrella675-ctrl/secret-auction.git
cd secret-auction
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Configure environment**

Create `.env.local` in `packages/nextjs-showcase/`:
```env
NEXT_PUBLIC_CONTRACT_ADDRESS=<your_deployed_contract_address>
```

4. **Deploy smart contract** (Optional - skip if using existing contract)
```bash
cd packages/hardhat
pnpm hardhat run scripts/deploy.ts --network sepolia
```

5. **Start the application**
```bash
cd packages/nextjs-showcase
pnpm dev
```

6. **Access the app**
```
http://localhost:3000
```

## 🎮 How to Use

### 1. Connect Wallet
- Click "Connect Wallet" button
- Select your wallet (MetaMask, WalletConnect, etc.)
- Switch to Sepolia network if prompted

### 2. Initialize FHEVM
- Wait for automatic FHEVM initialization (5-10 seconds)
- This sets up the encryption environment

### 3. Submit Encrypted Bid
- Enter your bid amount (e.g., 1200)
- Click "Submit Encrypted Bid"
- Approve the transaction in your wallet
- Wait for 10 seconds for permission synchronization

### 4. Decrypt Result
- Click "Decrypt Result" button
- Sign the EIP-712 message for decryption
- Wait 30-60 seconds for decryption
- View your result: 🎉 Won (1) or ❌ Lost (0)

### 5. Try Again
- Click "Try Again" to submit another bid
- Test different amounts above or below 1000

## 💡 How It Works

### Encryption Process
1. Your bid is encrypted using FHE on the client side
2. Only the encrypted value is sent to the blockchain
3. The smart contract never sees the plaintext bid

### Comparison Process
```solidity
// Smart contract compares encrypted values
euint32 encryptedBid = TFHE.asEuint32(encryptedInput, inputProof);
euint32 reservePrice = TFHE.asEuint32(1000);
ebool won = TFHE.gte(encryptedBid, reservePrice);
result[msg.sender] = TFHE.asEuint32(won);
```

### Decryption Process
1. Generate a keypair for decryption
2. Sign an EIP-712 message to prove ownership
3. Send request to Zama's Relayer service
4. Receive decrypted result (only visible to you)

## 🔧 Configuration

### FHEVM Configuration (Sepolia)
```typescript
{
  chainId: 11155111,
  aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
  inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
  gatewayChainId: 10901,
  relayerUrl: 'https://relayer.testnet.zama.org'
}
```

## 🧪 Testing Tips

### Reserve Price
The reserve price is set to **1000 units**:
- Bid > 1000 → Result = 1 (Won) 🎉
- Bid ≤ 1000 → Result = 0 (Lost) ❌

### Example Test Cases
```
Bid 500  → Lost  (below reserve)
Bid 1000 → Lost  (equal to reserve)
Bid 1001 → Won   (above reserve)
Bid 1500 → Won   (above reserve)
```

## 🐛 Troubleshooting

### FHEVM Initialization Failed
- Ensure you're on Sepolia network
- Clear browser cache and reload
- Check browser console for detailed errors

### Decryption Takes Too Long
- Normal wait time: 30-60 seconds
- Relayer may be under heavy load
- Auto-retry feature will attempt 3 times

### Transaction Reverted
- Ensure you have enough Sepolia ETH
- Check gas limits in MetaMask
- Wait for network congestion to clear

## 🔐 Security Considerations

### What's Encrypted
✅ Bid amounts are fully encrypted on-chain  
✅ Only you can decrypt your results  
✅ Contract cannot access plaintext bids  

### What's Public
⚠️ Transaction hashes and addresses are public  
⚠️ Timestamp of bid submission is visible  
⚠️ Gas usage patterns may reveal information  

## 🌐 Network Details

- **Network**: Sepolia Testnet
- **Chain ID**: 11155111
- **RPC URL**: https://rpc.sepolia.org
- **Explorer**: https://sepolia.etherscan.io

## 📚 Learn More

- [Zama FHEVM Documentation](https://docs.zama.org/fhevm)
- [FHEVM Solidity Library](https://github.com/zama-ai/fhevm)
- [Fully Homomorphic Encryption](https://en.wikipedia.org/wiki/Homomorphic_encryption)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- **Zama** - For providing FHEVM technology
- **Ethereum Foundation** - For Sepolia testnet
- **Hardhat** - For development tools
- **Next.js** - For the frontend framework

---

**Built with ❤️ using Zama's FHEVM v0.9**

🔗 [Demo](https://your-demo-url.vercel.app) | 📖 [Documentation](https://docs.zama.org/fhevm) | 🐦 [Twitter](https://twitter.com/zama_fhe)
