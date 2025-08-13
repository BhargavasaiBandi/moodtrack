// src/WalletProvider.js
import React from 'react';
import {
  AptosWalletAdapterProvider,
  useWallet
} from '@aptos-labs/wallet-adapter-react';
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';
import { Network } from '@aptos-labs/ts-sdk';

// Import CSS for wallet selector
import '@aptos-labs/wallet-adapter-ant-design/dist/index.css';

export const AppWalletProvider = ({ children }) => {
  return (
    <AptosWalletAdapterProvider
      plugins={[]} // Empty array - will detect installed wallets automatically
      autoConnect={true}
      dappConfig={{
        network: Network.DEVNET,
        name: "MoodMap",
        description: "A mood tracking dapp on Aptos",
      }}
      onError={(error) => {
        console.error('Wallet error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
};

export const WalletConnector = () => {
  const { connected, account, disconnect } = useWallet();

  // Debug: Log account structure when connected
  React.useEffect(() => {
    if (connected && account) {
      console.log('Account object:', account);
      console.log('Account address:', account?.address);
      console.log('Type of address:', typeof account?.address);
    }
  }, [connected, account]);

  // Safe function to get displayable address
  const getDisplayAddress = () => {
    try {
      if (!account) return 'Connected';
      
      let addressStr = '';
      
      // Try different ways to get the address
      if (typeof account.address === 'string') {
        addressStr = account.address;
      } else if (account.address && account.address.toString) {
        addressStr = account.address.toString();
      } else if (account.publicKey) {
        addressStr = account.publicKey;
      } else {
        return 'Connected';
      }
      
      // Make sure we have a valid string before slicing
      if (addressStr && addressStr.length > 10) {
        return `${addressStr.slice(0, 6)}...${addressStr.slice(-4)}`;
      }
      
      return 'Connected';
    } catch (error) {
      console.error('Error displaying address:', error);
      return 'Connected';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {!connected ? (
        <WalletSelector />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'white' }}>
            {getDisplayAddress()}
          </span>
          <button 
            onClick={disconnect}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};