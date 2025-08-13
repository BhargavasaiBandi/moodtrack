// src/WalletProvider.js
import React from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Button } from 'antd';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

// Empty wallets array - will auto-detect installed wallet extensions
const wallets = [];

// Wallet Provider Component
export const AppWalletProvider = ({ children }) => {
  const onError = (error) => {
    console.error("Wallet error:", error);
    // Safe error handling - check if error exists and has properties
    if (error && typeof error === 'object') {
      if ('message' in error && error.message) {
        console.error("Error message:", error.message);
      }
    }
  };

  return (
    <AptosWalletAdapterProvider 
      plugins={wallets} 
      autoConnect={true}
      onError={onError}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
};

// Wallet Connector Component
export const WalletConnector = () => {
  const { 
    connect, 
    disconnect, 
    connected, 
    wallet,
    wallets: availableWallets
  } = useWallet();

  const handleConnect = async () => {
    try {
      // Check if wallets are available
      if (!availableWallets || availableWallets.length === 0) {
        console.error("No wallets available. Please install a wallet like Petra.");
        return;
      }

      // Connect to first available wallet
      const firstWallet = availableWallets[0];
      if (firstWallet && firstWallet.name) {
        console.log("Connecting to:", firstWallet.name);
        await connect(firstWallet.name);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  };

  if (connected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'white' }}>
          {wallet && wallet.name ? wallet.name : 'Wallet'} Connected
        </span>
        <Button 
          type="primary" 
          size="small" 
          onClick={handleDisconnect}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button 
      type="primary" 
      onClick={handleConnect}
    >
      Connect Wallet
    </Button>
  );
};