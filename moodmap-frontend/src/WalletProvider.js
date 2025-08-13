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
    console.error("Wallet error details:", {
      error: error,
      message: error?.message,
      code: error?.code,
      type: typeof error,
      keys: error ? Object.keys(error) : 'no keys'
    });
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
      console.log('Available wallets:', availableWallets);
      
      if (!availableWallets || availableWallets.length === 0) {
        console.error("No wallets available. Please install a wallet like Petra.");
        return;
      }

      const firstWallet = availableWallets[0];
      console.log('Connecting to wallet:', firstWallet);
      
      if (firstWallet && firstWallet.name) {
        console.log("Connecting to:", firstWallet.name);
        await connect(firstWallet.name);
        console.log("Connection successful");
      }
    } catch (error) {
      console.error("Failed to connect wallet - detailed error:", {
        error: error,
        message: error?.message,
        stack: error?.stack
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      console.log("Disconnecting wallet...");
      await disconnect();
      console.log("Disconnect successful");
    } catch (error) {
      console.error("Failed to disconnect wallet - detailed error:", {
        error: error,
        message: error?.message,
        stack: error?.stack
      });
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