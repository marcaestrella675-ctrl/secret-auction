'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers, BrowserProvider } from 'ethers';
import Link from 'next/link';
import { getWalletProvider } from '@/utils/wallet';

// FHEVM v0.9 Configuration
const FHEVM_CONFIG = {
  chainId: 11155111, // Sepolia
  aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
  inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
  gatewayChainId: 10901,
  relayerUrl: 'https://relayer.testnet.zama.org',
};

// Contract Configuration (will be set after deployment)
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
const CONTRACT_ABI = [
  "function submitBid(bytes32 encryptedBid, bytes proof) external",
  "function getMyResult() external view returns (bytes32)",
  "function hasBid(address) external view returns (bool)",
  "function bidTimestamp(address) external view returns (uint256)",
  "event BidSubmitted(address indexed bidder, uint256 timestamp)"
];

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function AuctionPage() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // FHEVM State
  const [fhevmInstance, setFhevmInstance] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const isInitializingRef = useRef(false);

  // Bid State
  const [bidAmount, setBidAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasBidSubmitted, setHasBidSubmitted] = useState(false);
  const [canDecrypt, setCanDecrypt] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 重置状态，允许再次出价
  const handleTryAgain = () => {
    setBidAmount('');
    setHasBidSubmitted(false);
    setCanDecrypt(false);
    setCountdown(0);
    setResult(null);
    setError(null);
    console.log('🔄 Reset for new bid');
  };

  // Initialize FHEVM when wallet connects
  useEffect(() => {
    if (!isConnected || !address || !walletClient || fhevmInstance || isInitializingRef.current) {
      return;
    }

    const initFhevm = async () => {
      isInitializingRef.current = true;
      setIsInitializing(true);
      setInitError(null);

      try {
        // Wait for relayerSDK to load
        if (!(window as any).relayerSDK) {
          throw new Error('Relayer SDK not loaded. Please refresh the page.');
        }

        // Initialize SDK
        await (window as any).relayerSDK.initSDK();

        // Get provider with multiple fallbacks
        let provider = getWalletProvider();

        if (!provider && walletClient) {
          provider = walletClient;
        }

        if (!provider) {
          throw new Error('No wallet provider found. Please install MetaMask or another Web3 wallet.');
        }

        // Create FHEVM instance
        const instance = await (window as any).relayerSDK.createInstance({
          ...FHEVM_CONFIG,
          network: provider,
        });

        setFhevmInstance(instance);
        console.log('✅ FHEVM initialized successfully');
      } catch (e: any) {
        console.error('❌ FHEVM init failed:', e);
        setInitError(e.message || 'Failed to initialize FHEVM');
        isInitializingRef.current = false;
      } finally {
        setIsInitializing(false);
      }
    };

    initFhevm();
  }, [isConnected, address, walletClient, fhevmInstance]);

  // Check if user has already bid (removed - allow multiple bids)
  // useEffect(() => {
  //   if (!isConnected || !address || !walletClient || !CONTRACT_ADDRESS) return;
  //
  //   const checkBidStatus = async () => {
  //     try {
  //       const provider = new BrowserProvider(walletClient as any);
  //       const signer = await provider.getSigner();
  //       const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  //       
  //       const hasBid = await contract.hasBid(address);
  //       setHasBidSubmitted(hasBid);
  //       
  //       // 如果用户已经提交过出价，直接允许解密
  //       if (hasBid) {
  //         setCanDecrypt(true);
  //         console.log('✅ User has already bid, can decrypt immediately');
  //       }
  //     } catch (e) {
  //       console.error('Error checking bid status:', e);
  //     }
  //   };
  //
  //   checkBidStatus();
  // }, [isConnected, address, walletClient]);

  /**
   * Handle bid submission
   * 1. Encrypt bid amount using FHE
   * 2. Submit to smart contract
   * 3. Wait for transaction confirmation
   * 4. Start countdown for permission sync
   */
  const handleSubmitBid = async () => {
    if (!fhevmInstance || !walletClient || !address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    if (!CONTRACT_ADDRESS) {
      setError('Contract not deployed yet. Please wait.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Encrypt bid amount
      console.log('🔐 Encrypting bid amount:', bidAmount);
      const input = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.add32(parseInt(bidAmount));
      const encryptedInput = await input.encrypt();
      
      const handle = encryptedInput.handles[0];
      const proof = encryptedInput.inputProof;

      console.log('✅ Encryption complete');

      // Step 2: Submit to contract
      console.log('📤 Submitting bid to contract...');
      const provider = new BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.submitBid(handle, proof);
      console.log('⏳ Transaction sent:', tx.hash);

      await tx.wait();
      console.log('✅ Transaction confirmed!');

      setHasBidSubmitted(true);
      setBidAmount('');

      // Step 3: Start countdown for permission sync
      setCountdown(10);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanDecrypt(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (e: any) {
      console.error('❌ Bid submission failed:', e);
      setError(e.message || 'Failed to submit bid');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle result decryption
   * 1. Get encrypted result from contract
   * 2. Generate keypair for decryption
   * 3. Create EIP-712 signature
   * 4. Call userDecrypt to get result
   */
  const handleDecryptResult = async (retryCount = 0) => {
    if (!fhevmInstance || !walletClient || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setIsDecrypting(true);
    setError(null);

    try {
      console.log('🔍 Fetching encrypted result...');
      const provider = new BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Step 1: Get encrypted result handle
      const encryptedHandle = await contract.getMyResult();
      console.log('✅ Got encrypted handle');

      // Step 2: Generate keypair
      const keypair = fhevmInstance.generateKeypair();

      // Step 3: Prepare decrypt parameters
      const handleContractPairs = [
        { handle: encryptedHandle, contractAddress: CONTRACT_ADDRESS }
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      const contractAddresses = [CONTRACT_ADDRESS];

      // Step 4: Create EIP-712 signature
      const eip712 = fhevmInstance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      // Remove EIP712Domain from types
      const typesWithoutDomain = { ...eip712.types };
      delete typesWithoutDomain.EIP712Domain;

      console.log('✍️ Requesting signature...');
      const signature = await signer.signTypedData(
        eip712.domain,
        typesWithoutDomain,
        eip712.message
      );
      console.log('✅ Signature received');

      // Step 5: Decrypt result
      console.log('🔓 Decrypting result... (this may take 30-60 seconds)');
      const decryptedResults = await fhevmInstance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const decryptedValue = decryptedResults[encryptedHandle];
      console.log('✅ Decrypted result:', decryptedValue);

      setResult(decryptedValue);
      setCanDecrypt(false);

    } catch (e: any) {
      console.error('❌ Decryption failed:', e);
      
      // Auto-retry on 500 error (permission sync issue)
      if (e.message?.includes('500') && retryCount < 3) {
        const waitTime = (retryCount + 1) * 10;
        console.log(`⚠️ Retry ${retryCount + 1}/3 after ${waitTime}s...`);
        setError(`Retrying... (${retryCount + 1}/3)`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        return handleDecryptResult(retryCount + 1);
      }
      
      setError(e.message || 'Failed to decrypt result');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Render: Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-8">Please connect your wallet to participate in the auction</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  // Render: Initializing FHEVM
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-75"></div>
            <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Initializing FHEVM...</h2>
          <p className="text-gray-400">Setting up encryption environment</p>
        </div>
      </div>
    );
  }

  // Render: Initialization error
  if (initError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Initialization Failed</h2>
          <p className="text-red-400 mb-6">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Main auction interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">SecretAuction</span>
            </Link>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-4">
            Encrypted Auction
          </h1>
          <p className="text-xl text-gray-300">
            Submit your bid. Only you will know if you won.
          </p>
        </div>

        {/* Info Card */}
        <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-blue-300 text-sm leading-relaxed">
                <strong>How it works:</strong> Your bid is encrypted using FHE before submission. 
                The smart contract compares it against the reserve price (1000) without decrypting. 
                Only you can decrypt your result: 1 = Won, 0 = Lost.
              </p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-xl opacity-20"></div>
          <div className="relative bg-slate-800/80 backdrop-blur-sm p-8 rounded-3xl border border-slate-700">
            {/* Bid Form */}
            {!hasBidSubmitted && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Your Bid Amount
                </label>
                <div className="relative mb-6">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Enter amount (e.g. 1200)"
                    disabled={isSubmitting}
                    className="w-full px-4 py-4 bg-slate-900 border border-slate-700 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <span className="text-gray-500 font-semibold">UNITS</span>
                  </div>
                </div>

                <button
                  onClick={handleSubmitBid}
                  disabled={isSubmitting || !bidAmount}
                  className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white text-lg font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting Encrypted Bid...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Submit Encrypted Bid
                    </span>
                  )}
                </button>

                <p className="text-xs text-gray-500 mt-3 text-center">
                  💡 Hint: The reserve price is 1000. Try bidding above or below to see results.
                </p>
              </div>
            )}

            {/* Waiting for Permission Sync */}
            {hasBidSubmitted && countdown > 0 && (
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-500/10 border-2 border-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-yellow-500">{countdown}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Syncing Permissions...</h3>
                <p className="text-gray-400">Please wait {countdown} seconds for blockchain confirmation</p>
              </div>
            )}

            {/* Decrypt Button */}
            {canDecrypt && result === null && (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/10 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Bid Submitted Successfully!</h3>
                <button
                  onClick={() => handleDecryptResult()}
                  disabled={isDecrypting}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded-xl transition disabled:cursor-not-allowed"
                >
                  {isDecrypting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Decrypting... (30-60s)
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      Decrypt Result
                    </span>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-3">
                  Click to decrypt your result. This will require a signature.
                </p>
              </div>
            )}

            {/* Result Display */}
            {result !== null && (
              <div className="text-center">
                {result === 1 ? (
                  <div>
                    <div className="w-20 h-20 bg-green-500/10 border-4 border-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                      <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-3xl font-bold text-green-500 mb-2">🎉 You Won!</h3>
                    <p className="text-gray-300 mb-6">Your bid was higher than the reserve price</p>
                  </div>
                ) : (
                  <div>
                    <div className="w-20 h-20 bg-red-500/10 border-4 border-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-3xl font-bold text-red-500 mb-2">Bid Too Low</h3>
                    <p className="text-gray-300 mb-6">Your bid was below the reserve price</p>
                  </div>
                )}
                <button
                  onClick={handleTryAgain}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 text-center">
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h4 className="text-white font-semibold mb-2">Fully Encrypted</h4>
            <p className="text-sm text-gray-400">Your bid is encrypted before touching the blockchain</p>
          </div>

          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 text-center">
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h4 className="text-white font-semibold mb-2">Private Results</h4>
            <p className="text-sm text-gray-400">Only you can decrypt and see your bid result</p>
          </div>

          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 text-center">
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="text-white font-semibold mb-2">Instant Verification</h4>
            <p className="text-sm text-gray-400">Smart contract verifies without decryption</p>
          </div>
        </div>
      </div>
    </div>
  );
}

