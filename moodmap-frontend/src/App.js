// src/App.js - FIXED VERSION - Emojis Available After Wallet Connection
import React, { useState, useEffect } from 'react';
import { Layout, Card, Button, message, Row, Col, Typography, Statistic, Input, Modal, Alert } from 'antd';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SmileOutlined, FrownOutlined, MehOutlined, WalletOutlined } from '@ant-design/icons';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AppWalletProvider, WalletConnector } from './WalletProvider';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

// ✅ FORCE TESTNET CONFIGURATION
const TESTNET_CONFIG = {
  network: Network.TESTNET,
  fullnodeUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
  indexerUrl: 'https://indexer-testnet.staging.gcp.aptosdev.com/v1/graphql',
  faucetUrl: 'https://faucet.testnet.aptoslabs.com'
};

const aptosConfig = new AptosConfig(TESTNET_CONFIG);
const aptos = new Aptos(aptosConfig);

const MODULE_ADDRESS = "0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9";

const MoodMapContent = () => {
  const { connected, account, signAndSubmitTransaction, network } = useWallet();
  const [moodData, setMoodData] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [userMood, setUserMood] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMoodData, setSelectedMoodData] = useState(null);
  const [networkStatus, setNetworkStatus] = useState('checking');
  const [walletNetwork, setWalletNetwork] = useState('unknown');
  const [contractInitialized, setContractInitialized] = useState(false);
  const [debugInfo, setDebugInfo] = useState([]);

  const moodOptions = [
    { value: 0, name: 'Terrible', emoji: '😰', color: '#ff4d4f' },
    { value: 1, name: 'Sad', emoji: '😢', color: '#ff7a45' },
    { value: 2, name: 'Neutral', emoji: '😐', color: '#fadb14' },
    { value: 3, name: 'Happy', emoji: '😊', color: '#52c41a' },
    { value: 4, name: 'Ecstatic', emoji: '🤩', color: '#1890ff' }
  ];

  // ✅ DEBUG LOGGING FUNCTION
  const addDebug = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const debugMsg = `[${timestamp}] ${message}`;
    setDebugInfo(prev => [...prev.slice(-10), debugMsg]); // Keep last 10 messages
    console.log(`[MoodMap Debug] ${message}`);
  };

  // ✅ DETECT WALLET NETWORK
  useEffect(() => {
    const detectWalletNetwork = async () => {
      if (connected && account) {
        addDebug("🔍 Detecting wallet network...");
        
        if (network) {
          const networkName = network.name || network.toString();
          addDebug(`Detected wallet network: ${networkName}`);
          setWalletNetwork(networkName.toLowerCase());
          
          if (networkName.toLowerCase().includes('mainnet')) {
            addDebug("❌ WALLET IS ON MAINNET!");
            message.error('🚨 Your wallet is connected to MAINNET! Please switch to TESTNET.');
            return;
          } else if (networkName.toLowerCase().includes('testnet')) {
            addDebug("✅ WALLET IS ON TESTNET!");
            setWalletNetwork('testnet');
          }
        }
      }
    };

    detectWalletNetwork();
  }, [connected, account, network]);

  const getAccountAddress = () => {
    if (!account) return null;
    if (typeof account.address === 'string') return account.address;
    if (account.address && typeof account.address === 'object') {
      if (account.address.toString) return account.address.toString();
      if (account.address.data) return account.address.data;
      if (account.address.hex) return account.address.hex;
    }
    return null;
  };

  const isWalletReady = () => {
    return !!(connected && account && signAndSubmitTransaction && typeof signAndSubmitTransaction === 'function');
  };

  const validateWalletNetwork = () => {
    if (walletNetwork === 'mainnet') {
      message.error('🚨 Your wallet is on MAINNET! Switch to TESTNET first!');
      return false;
    }
    if (walletNetwork !== 'testnet' && walletNetwork !== 'unknown') {
      message.warning('⚠️ Cannot confirm wallet is on testnet. Proceed with caution.');
    }
    return true;
  };

  // ✅ TESTNET VERIFICATION
  useEffect(() => {
    const verifyTestnetConnection = async () => {
      addDebug("🔍 Verifying testnet connection...");
      
      try {
        const response = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}`);
        const data = await response.json();
        
        if (response.ok) {
          addDebug(`✅ CONTRACT FOUND ON TESTNET! Sequence: ${data.sequence_number}`);
          
          const modulesResponse = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/modules`);
          const modulesData = await modulesResponse.json();
          
          if (modulesData.some(m => m.abi?.name === 'moodmap')) {
            addDebug("✅ MOODMAP MODULE VERIFIED ON TESTNET!");
            setNetworkStatus('testnet-verified');
            
            // ✅ More aggressive contract status checking  
            setTimeout(() => {
              addDebug("🔄 Initial contract status check after testnet verification...");
              checkContractStatus();
              
              // Double-check after 3 seconds if still not detected
              setTimeout(() => {
                if (!contractInitialized) {
                  addDebug("🔄 Secondary contract status check...");
                  checkContractStatus();
                }
              }, 3000);
            }, 1000);
          } else {
            setNetworkStatus('module-not-found');
          }
        }
      } catch (error) {
        addDebug(`❌ Testnet verification failed: ${error.message}`);
        setNetworkStatus('testnet-error');
      }
    };

    verifyTestnetConnection();
  }, []);

  // ✅ IMPROVED CONTRACT STATUS DETECTION - Handle the actual state correctly
  const checkContractStatus = async () => {
    addDebug("🔄 Checking contract status...");
    
    try {
      // Method 1: Direct API call to check if resource exists
      const resourceResponse = await fetch(
        `https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/resource/${MODULE_ADDRESS}::moodmap::MoodMap`
      );
      
      if (resourceResponse.ok) {
        const resourceData = await resourceResponse.json();
        addDebug("✅ CONTRACT IS INITIALIZED (resource exists via API)!");
        setContractInitialized(true);
        message.success('✅ Contract is ready and initialized!');
        setTimeout(fetchMoodData, 500);
        return;
      } else {
        addDebug(`API response not OK: ${resourceResponse.status}`);
      }
      
      // Method 2: Try using Aptos SDK
      const resource = await aptos.getAccountResource({
        accountAddress: MODULE_ADDRESS,
        resourceType: `${MODULE_ADDRESS}::moodmap::MoodMap`
      });
      
      addDebug("✅ CONTRACT IS INITIALIZED (resource exists via SDK)!");
      setContractInitialized(true);
      message.success('✅ Contract is ready and initialized!');
      setTimeout(fetchMoodData, 500);
      
    } catch (error) {
      addDebug(`Error checking contract: ${error.message}`);
      
      // ✅ KEY FIX: E_ALREADY_INITIALIZED means it IS initialized!
      if (error.message?.includes('E_ALREADY_INITIALIZED') || 
          error.message?.includes('ALREADY_INITIALIZED') ||
          error.message?.includes('0x3')) {
        addDebug("✅ CONTRACT IS INITIALIZED (confirmed by E_ALREADY_INITIALIZED error)!");
        setContractInitialized(true);
        message.success('✅ Contract is already initialized and ready to use!');
        setTimeout(fetchMoodData, 500);
      } 
      // ✅ E_MOODMAP_NOT_INITIALIZED means it's NOT initialized
      else if (error.message?.includes('E_MOODMAP_NOT_INITIALIZED') || 
               error.message?.includes('MOODMAP_NOT_INITIALIZED') ||
               error.message?.includes('0x2')) {
        addDebug("❌ CONTRACT IS NOT INITIALIZED");
        setContractInitialized(false);
        message.warning('Contract needs initialization.');
      } 
      // ✅ Resource not found also means not initialized
      else if (error.message?.includes('resource not found') || 
               error.message?.includes('Resource not found') ||
               error.message?.includes('404')) {
        addDebug("❌ CONTRACT RESOURCE NOT FOUND - NOT INITIALIZED");
        setContractInitialized(false);
        message.warning('Contract not found - needs initialization.');
      } else {
        addDebug("❓ Contract status unclear - will try to detect from operations");
        // Don't change the state - let other operations determine it
        message.info('Contract status unclear. Try operations to determine state.');
      }
    }
  };

  const fetchMoodData = async () => {
    if (networkStatus !== 'testnet-verified') return;
    
    setLoading(true);
    try {
      addDebug("🔄 Fetching mood data from TESTNET...");
      
      try {
        const resource = await aptos.getAccountResource({
          accountAddress: MODULE_ADDRESS,
          resourceType: `${MODULE_ADDRESS}::moodmap::MoodMap`
        });
        
        addDebug("✅ MoodMap resource found, fetching data...");
        setContractInitialized(true);
        
        let moodCounts = await aptos.view({
          function: `${MODULE_ADDRESS}::moodmap::get_mood_counts`,
          type_arguments: [],
          arguments: []
        });
        
        let total = await aptos.view({
          function: `${MODULE_ADDRESS}::moodmap::get_total_entries`,
          type_arguments: [],
          arguments: []
        });

        setTotalEntries(parseInt(total[0]));
        const chartData = moodOptions.map((mood, i) => ({
          name: mood.name,
          value: parseInt(moodCounts[0][i] || 0),
          emoji: mood.emoji,
          color: mood.color
        })).filter(item => item.value > 0);
        setMoodData(chartData);

        if (isWalletReady()) await fetchUserMood();

      } catch (resourceError) {
        addDebug("Contract resource not found (needs initialization)");
        setContractInitialized(false);
        setTotalEntries(0);
        setMoodData([]);
      }

    } catch (err) {
      addDebug(`Error fetching mood data: ${err.message}`);
      setTotalEntries(0);
      setMoodData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserMood = async () => {
    if (!isWalletReady()) return;
    
    try {
      const userAddress = getAccountAddress();
      if (!userAddress) return;

      const userMoodData = await aptos.view({
        function: `${MODULE_ADDRESS}::moodmap::get_user_mood`,
        type_arguments: [],
        arguments: [userAddress]
      });

      if (userMoodData && userMoodData[0] !== undefined) {
        setUserMood({
          mood: parseInt(userMoodData[0]),
          message: userMoodData[1],
          timestamp: parseInt(userMoodData[2])
        });
      }
    } catch (error) {
      addDebug(`Error fetching user mood: ${error.message}`);
      setUserMood(null);
    }
  };

  const initializeContract = async () => {
    addDebug("🔄 Starting contract initialization...");
    
    if (!connected || !account || !signAndSubmitTransaction) {
      message.warning('Please connect your wallet first!');
      return;
    }

    if (!validateWalletNetwork()) {
      return;
    }

    if (networkStatus !== 'testnet-verified') {
      message.error('❌ Testnet connection not verified. Cannot initialize.');
      return;
    }

    // ✅ IMPROVED: Check if already initialized first
    try {
      addDebug("Checking if contract is already initialized...");
      const resource = await aptos.getAccountResource({
        accountAddress: MODULE_ADDRESS,
        resourceType: `${MODULE_ADDRESS}::moodmap::MoodMap`
      });
      
      addDebug("✅ CONTRACT IS ALREADY INITIALIZED!");
      message.success('✅ Contract is already initialized!');
      setContractInitialized(true);
      setTimeout(fetchMoodData, 1000);
      return;
    } catch (resourceError) {
      // ✅ KEY FIX: Also check for E_ALREADY_INITIALIZED in the error
      if (resourceError.message?.includes('E_ALREADY_INITIALIZED') || 
          resourceError.message?.includes('ALREADY_INITIALIZED') ||
          resourceError.message?.includes('0x3')) {
        addDebug("✅ CONTRACT IS ALREADY INITIALIZED (from error check)!");
        message.success('✅ Contract is already initialized!');
        setContractInitialized(true);
        setTimeout(fetchMoodData, 1000);
        return;
      }
      addDebug("Contract not initialized, proceeding with initialization...");
    }

    try {
      setLoading(true);
      message.info('Initializing contract on TESTNET...');
      
      const transaction = {
        data: {
          function: `${MODULE_ADDRESS}::moodmap::initialize`,
          typeArguments: [],
          functionArguments: []
        }
      };

      addDebug('🚀 Submitting transaction to TESTNET...');
      const response = await signAndSubmitTransaction(transaction);
      
      if (response?.hash) {
        addDebug('⏳ Waiting for transaction confirmation...');
        await aptos.waitForTransaction({ transactionHash: response.hash });
        message.success('✅ Contract initialized on TESTNET! 🎉');
        setContractInitialized(true);
        setTimeout(fetchMoodData, 3000);
      }
    } catch (error) {
      addDebug(`❌ Initialization error: ${error.message}`);
      
      if (error.message?.includes('E_ALREADY_INITIALIZED') || 
          error.message?.includes('ALREADY_INITIALIZED') ||
          error.message?.includes('0x3')) {
        addDebug("✅ Contract is already initialized!");
        message.success('✅ Contract is already initialized!');
        setContractInitialized(true);
        setTimeout(fetchMoodData, 1000);
      } else if (error.message?.includes('mainnet') || error.message?.includes('devnet')) {
        message.error('🚨 WALLET NETWORK MISMATCH! Your wallet is not on TESTNET!');
      } else {
        message.error(`Initialization failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ KEY FIX: Allow mood setting even if contract not initialized
  const setMood = async (moodValue) => {
    if (!connected) {
      message.warning('Please connect your wallet first!');
      return;
    }
    if (!validateWalletNetwork()) {
      return;
    }
    if (networkStatus !== 'testnet-verified') {
      message.error('❌ Testnet connection not verified!');
      return;
    }
    
    addDebug(`Selected mood: ${moodOptions[moodValue].emoji} ${moodOptions[moodValue].name}`);
    setSelectedMoodData({ value: moodValue, name: moodOptions[moodValue].name });
    setShowMoodModal(true);
  };

  const submitMood = async () => {
    if (!selectedMoodData || !moodMessage.trim()) {
      message.warning('Please enter a message about your mood!');
      return;
    }
    
    if (!isWalletReady()) {
      message.error('Wallet not connected properly.');
      return;
    }

    if (!validateWalletNetwork()) {
      return;
    }

    try {
      setLoading(true);
      const messageBytes = Array.from(new TextEncoder().encode(moodMessage));
      
      const transaction = {
        data: {
          function: `${MODULE_ADDRESS}::moodmap::set_mood`,
          typeArguments: [],
          functionArguments: [selectedMoodData.value, messageBytes]
        }
      };

      addDebug('🚀 Submitting mood to TESTNET...');
      const response = await signAndSubmitTransaction(transaction);
      
      if (response?.hash) {
        await aptos.waitForTransaction({ transactionHash: response.hash });
        message.success(`✅ Mood "${selectedMoodData.name}" set on TESTNET! 🎉`);
        addDebug(`✅ Mood submitted successfully: ${selectedMoodData.name}`);
        setShowMoodModal(false);
        setMoodMessage('');
        setSelectedMoodData(null);
        
        // If contract wasn't initialized before, it is now!
        if (!contractInitialized) {
          setContractInitialized(true);
          message.info('🎉 Contract was automatically initialized with your first mood!');
        }
        
        setTimeout(fetchMoodData, 2000);
      }
    } catch (error) {
      addDebug(`❌ Error setting mood: ${error.message}`);
      
      // ✅ IMPROVED ERROR HANDLING FOR SPECIFIC MOODMAP ERRORS
      if (error.message?.includes('E_MOODMAP_NOT_INITIALIZED') || 
          error.message?.includes('MOODMAP_NOT_INITIALIZED') ||
          error.message?.includes('0x2')) {
        
        message.error('❌ Contract not initialized! Please initialize first.');
        setContractInitialized(false);
        setShowMoodModal(false);
        
        // Show initialization prompt
        Modal.confirm({
          title: 'Contract Needs Initialization',
          content: 'The MoodMap contract needs to be initialized before you can submit moods. Would you like to initialize it now?',
          okText: 'Yes, Initialize Now',
          cancelText: 'Cancel',
          onOk: () => {
            initializeContract();
          }
        });
        
      } else if (error.message?.includes('E_NOT_INITIALIZED') || 
                 error.message?.includes('NOT_INITIALIZED')) {
        message.error('❌ Contract needs to be initialized first. Please initialize the contract.');
        setContractInitialized(false);
      } else if (error.message?.includes('mainnet') || error.message?.includes('devnet')) {
        message.error('🚨 WALLET NETWORK MISMATCH! Check your wallet network!');
      } else {
        message.error(`Failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ FORCE CHECK CONTRACT STATUS ON WALLET CONNECTION - More aggressive checking
  useEffect(() => {
    if (networkStatus === 'testnet-verified' && connected) {
      addDebug("🔄 Wallet connected - checking contract status immediately...");
      // Check immediately and then again after a delay
      checkContractStatus();
      setTimeout(() => {
        if (!contractInitialized) {
          addDebug("🔄 Rechecking contract status after delay...");
          checkContractStatus();
        }
      }, 3000);
    }
  }, [connected, networkStatus]);

  useEffect(() => {
    if (networkStatus === 'testnet-verified') {
      fetchMoodData();
      const interval = setInterval(fetchMoodData, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, account, networkStatus]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <p>{`${data.emoji} ${data.name}: ${data.value} people`}</p>
        </div>
      );
    }
    return null;
  };

  const getNetworkStatusColor = () => {
    switch (networkStatus) {
      case 'testnet-verified': return '#52c41a';
      case 'checking': return '#faad14';
      case 'testnet-error': return '#ff4d4f';
      case 'module-not-found': return '#ff7a45';
      default: return '#d9d9d9';
    }
  };

  const getNetworkStatusText = () => {
    switch (networkStatus) {
      case 'testnet-verified': return '✅ Testnet Connected';
      case 'checking': return '🔄 Checking Network...';
      case 'testnet-error': return '❌ Testnet Connection Failed';
      case 'module-not-found': return '⚠️ Module Not Found';
      default: return '❓ Unknown Status';
    }
  };

  // ✅ SIMPLIFIED: Show emojis when wallet is connected and testnet is verified
  const shouldShowEmojis = () => {
    return networkStatus === 'testnet-verified' && connected;
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Header style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={2} style={{ color: 'white', margin: 0 }}>🗺️ MoodMap</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              color: getNetworkStatusColor(), 
              fontSize: '12px', 
              fontWeight: 'bold',
              background: 'rgba(255,255,255,0.1)',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              {getNetworkStatusText()}
            </div>
            {connected && walletNetwork && (
              <div style={{ 
                color: walletNetwork === 'testnet' ? '#52c41a' : '#ff4d4f',
                fontSize: '11px',
                background: 'rgba(255,255,255,0.1)',
                padding: '2px 6px',
                borderRadius: '3px'
              }}>
                Wallet: {walletNetwork.toUpperCase()}
              </div>
            )}
            {networkStatus === 'testnet-verified' && (
              <div style={{ 
                color: contractInitialized ? '#52c41a' : '#faad14',
                fontSize: '11px',
                background: 'rgba(255,255,255,0.1)',
                padding: '2px 6px',
                borderRadius: '3px'
              }}>
                Contract: {contractInitialized ? 'READY' : 'PENDING'}
              </div>
            )}
            <WalletConnector />
          </div>
        </div>
      </Header>

      <Content style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Row gutter={[24, 24]}>
          {/* Debug Panel */}
          {debugInfo.length > 0 && (
            <Col span={24}>
              <Card 
                title="🔍 Debug Information" 
                size="small"
                style={{ 
                  background: 'rgba(0,0,0,0.8)', 
                  color: '#00ff00',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
                bodyStyle={{ maxHeight: '150px', overflowY: 'auto' }}
              >
                {debugInfo.map((info, idx) => (
                  <div key={idx} style={{ color: '#00ff00', marginBottom: '2px' }}>{info}</div>
                ))}
              </Card>
            </Col>
          )}

          {/* Mainnet Warning */}
          {connected && walletNetwork === 'mainnet' && (
            <Col span={24}>
              <Alert
                message="🚨 CRITICAL: WALLET NETWORK MISMATCH!"
                description="Your wallet is connected to MAINNET but this app requires TESTNET. Please switch your wallet to TESTNET."
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            </Col>
          )}

          {walletNetwork !== 'mainnet' && (
            <>
              {/* Network Status Check */}
              {networkStatus !== 'testnet-verified' && (
                <Col span={24}>
                  <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
                    <div style={{ color: getNetworkStatusColor(), fontSize: '48px', marginBottom: '16px' }}>
                      {networkStatus === 'checking' ? '🔄' : '❌'}
                    </div>
                    <Title level={3}>{getNetworkStatusText()}</Title>
                  </Card>
                </Col>
              )}

              {/* Connect Wallet */}
              {networkStatus === 'testnet-verified' && !connected && (
                <Col span={24}>
                  <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
                    <WalletOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                    <Title level={3}>Connect Your Wallet</Title>
                    <Text>Connect your wallet to share your mood and see the community sentiment!</Text>
                  </Card>
                </Col>
              )}

              {/* ✅ ADD MANUAL CONTRACT CHECK BUTTON ALWAYS VISIBLE */}
              {networkStatus === 'testnet-verified' && connected && (
                <Col span={24}>
                  <Card style={{ 
                    background: 'rgba(255,255,255,0.9)', 
                    backdropFilter: 'blur(10px)', 
                    borderRadius: '12px', 
                    border: 'none',
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <Text strong>Contract Status: </Text>
                        <Text style={{ 
                          color: contractInitialized ? '#52c41a' : '#faad14',
                          fontWeight: 'bold'
                        }}>
                          {contractInitialized ? '✅ INITIALIZED' : '⏳ CHECKING...'}
                        </Text>
                      </div>
                      
                      <Button 
                        size="small"
                        onClick={checkContractStatus} 
                        loading={loading}
                        type="default"
                      >
                        🔄 Force Refresh Status
                      </Button>
                    </div>
                  </Card>
                </Col>
              )}

              {/* ✅ SHOW INITIALIZATION INTERFACE ONLY WHEN TRULY NOT INITIALIZED */}
              {networkStatus === 'testnet-verified' && connected && !contractInitialized && (
                <Col span={24}>
                  <Card style={{ 
                    background: 'rgba(255, 193, 7, 0.1)', 
                    backdropFilter: 'blur(10px)', 
                    borderRadius: '16px', 
                    border: '2px solid #ffc107', 
                    textAlign: 'center' 
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                    <Title level={3} style={{ color: '#f57c00' }}>Contract Needs Initialization</Title>
                    <Text style={{ fontSize: '16px', marginBottom: '20px', display: 'block' }}>
                      If you see "E_ALREADY_INITIALIZED" error, your contract is actually ready! 
                      Try the "Force Refresh Status" button above first.
                    </Text>
                    
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Button 
                        type="primary" 
                        size="large"
                        onClick={initializeContract} 
                        loading={loading}
                        style={{ 
                          background: '#1890ff',
                          borderColor: '#1890ff',
                          minWidth: '180px' 
                        }}
                      >
                        Try Initialize (if really needed)
                      </Button>
                    </div>
                    
                    <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
                      <Text type="secondary">
                        💡 If initialization shows "E_ALREADY_INITIALIZED" error, just refresh the status above!
                      </Text>
                    </div>
                  </Card>
                </Col>
              )}

              {/* ✅ EMOJI SELECTION - NOW SHOWS WHEN WALLET IS CONNECTED */}
              {shouldShowEmojis() && (
                <>
                  {/* Stats Row */}
                  <Col span={24}>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={8}>
                        <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none' }}>
                          <Statistic 
                            title="Total Mood Entries" 
                            value={totalEntries} 
                            prefix={<SmileOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none' }}>
                          <Statistic 
                            title="Community Moods" 
                            value={moodData.length} 
                            prefix={<MehOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none' }}>
                          <Statistic 
                            title="Your Mood Status" 
                            value={userMood ? moodOptions[userMood.mood]?.name : 'Not Set'} 
                            prefix={userMood ? moodOptions[userMood.mood]?.emoji : '❓'}
                            valueStyle={{ color: userMood ? moodOptions[userMood.mood]?.color : '#999' }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </Col>

                  {/* Emoji Selection */}
                  <Col span={24}>
                    <Card 
                      title="How are you feeling today?" 
                      style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <Row gutter={[16, 16]} justify="center">
                          {moodOptions.map((mood) => (
                            <Col key={mood.value}>
                              <Button
                                type="primary"
                                size="large"
                                onClick={() => setMood(mood.value)}
                                style={{
                                  background: mood.color,
                                  borderColor: mood.color,
                                  fontSize: '32px',
                                  height: '80px',
                                  width: '80px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                loading={loading}
                              >
                                {mood.emoji}
                              </Button>
                              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                {mood.name}
                              </div>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    </Card>
                  </Col>

                  {/* Charts (only show if we have data) */}
                  {moodData.length > 0 && (
                    <Col span={24}>
                      <Row gutter={[24, 24]}>
                        <Col xs={24} lg={12}>
                          <Card 
                            title="Community Mood Distribution" 
                            style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}
                          >
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={moodData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={120}
                                  dataKey="value"
                                  label={({ name, value, emoji }) => `${emoji} ${name}: ${value}`}
                                >
                                  {moodData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                          <Card 
                            title="Mood Counts" 
                            style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}
                          >
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={moodData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="emoji" />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" fill="#1890ff" />
                              </BarChart>
                            </ResponsiveContainer>
                          </Card>
                        </Col>
                      </Row>
                    </Col>
                  )}

                  {/* User's Current Mood */}
                  {userMood && (
                    <Col span={24}>
                      <Card 
                        title="Your Current Mood" 
                        style={{ background: `linear-gradient(135deg, ${moodOptions[userMood.mood]?.color}20, white)`, backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}
                      >
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '64px', marginBottom: '16px' }}>
                            {moodOptions[userMood.mood]?.emoji}
                          </div>
                          <Title level={3} style={{ color: moodOptions[userMood.mood]?.color }}>
                            {moodOptions[userMood.mood]?.name}
                          </Title>
                          <Text style={{ fontSize: '16px', fontStyle: 'italic' }}>
                            "{userMood.message}"
                          </Text>
                          <br />
                          <Text type="secondary">
                            Recorded on {new Date(userMood.timestamp * 1000).toLocaleString()}
                          </Text>
                        </div>
                      </Card>
                    </Col>
                  )}
                </>
              )}
            </>
          )}
        </Row>

        {/* Mood Submission Modal */}
        <Modal
          title={selectedMoodData ? `Share your ${selectedMoodData.name} mood` : "Share your mood"}
          open={showMoodModal}
          onOk={submitMood}
          onCancel={() => { 
            setShowMoodModal(false); 
            setMoodMessage(''); 
            setSelectedMoodData(null); 
          }}
          confirmLoading={loading}
          okText="Share Mood on TESTNET"
        >
          {selectedMoodData && (
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                {moodOptions[selectedMoodData.value]?.emoji}
              </div>
              <Title level={4}>{selectedMoodData.name}</Title>
            </div>
          )}
          <TextArea 
            rows={4} 
            placeholder="Tell us more about how you're feeling... (required)" 
            value={moodMessage} 
            onChange={(e) => setMoodMessage(e.target.value)} 
            maxLength={200} 
          />
          <div style={{ marginTop: '8px', textAlign: 'right' }}>
            <Text type="secondary">{moodMessage.length}/200</Text>
          </div>
        </Modal>
      </Content>
    </Layout>
  );
};

const App = () => (
  <AppWalletProvider>
    <MoodMapContent />
  </AppWalletProvider>
);

export default App;