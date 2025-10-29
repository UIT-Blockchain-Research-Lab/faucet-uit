import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const FAUCET_ABI = [
  'function drip(address payable recipient) external',
  'function canDrip(address recipient) external view returns (bool)',
  'function getRemainingCooldown(address recipient) external view returns (uint256)',
  'function dripAmount() external view returns (uint256)',
  'function getFaucetBalance() external view returns (uint256)',
];

export async function POST(request: NextRequest) {
  try {
    const { recipient } = await request.json();

    if (!recipient || typeof recipient !== 'string') {
      return NextResponse.json(
        { error: 'Recipient address is required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!ethers.isAddress(recipient)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    // Get environment variables
    const privateKey = process.env.OWNER_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const faucetAddress = process.env.FAUCET_CONTRACT_ADDRESS;

    if (!privateKey || !rpcUrl || !faucetAddress) {
      console.error('Missing environment variables');
      return NextResponse.json(
        { error: 'Server configuration error. Please contact administrator.' },
        { status: 500 }
      );
    }

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const faucet = new ethers.Contract(faucetAddress, FAUCET_ABI, wallet);

    // Check if recipient can receive tokens
    const canDrip = await faucet.canDrip(recipient);
    if (!canDrip) {
      const remainingCooldown = await faucet.getRemainingCooldown(recipient);
      const hours = Math.ceil(Number(remainingCooldown) / 3600);
      const minutes = Math.ceil((Number(remainingCooldown) % 3600) / 60);
      
      let timeMessage = '';
      if (hours > 0) {
        timeMessage = `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        timeMessage = `${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
      
      return NextResponse.json(
        { error: `Please wait ${timeMessage} before requesting again` },
        { status: 429 }
      );
    }

    // Execute drip transaction
    const tx = await faucet.drip(recipient);
    const receipt = await tx.wait();

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: 'Tokens sent successfully!',
    });
  } catch (error: any) {
    console.error('Drip error:', error);
    
    let errorMessage = 'Failed to send tokens. Please try again.';
    
    if (error.reason) {
      errorMessage = error.reason;
    } else if (error.message) {
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Faucet has insufficient balance. Please contact administrator.';
      } else if (error.message.includes('nonce')) {
        errorMessage = 'Transaction pending. Please wait a moment and try again.';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}