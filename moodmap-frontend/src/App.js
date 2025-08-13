// src/App.js - FORCE TESTNET WITH WALLET VALIDATION
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

// Force log the configuration
console.log("🚨 FORCED TESTNET CONFIG:");
console.log("Network:", TESTNET_CONFIG.network);
console.log("Fullnode URL:", TESTNET_CONFIG.fullnodeUrl);
console.log("Aptos client URL:", aptos.config.fullnodeUrl);

const MODULE_ADDRESS = "0x61f562562dd61e1f376c1d5670885f13d7166e84867f6be5b56ba82cb2f59cf3";

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

  const moodOptions = [
    { value: 0, name: 'Terrible', emoji: '😰', color: '#ff4d4f' },
    { value: 1, name: 'Sad', emoji: '😢', color: '#ff7a45' },
    { value: 2, name: 'Neutral', emoji: '😐', color: '#fadb14' },
    { value: 3, name: 'Happy', emoji: '😊', color: '#52c41a' },
    { value: 4, name: 'Ecstatic', emoji: '🤩', color: '#1890ff' }
  ];

  // ✅ DETECT WALLET NETWORK
  useEffect(() => {
    const detectWalletNetwork = async () => {
      if (connected && account) {
        console.log("🔍 Detecting wallet network...");
        console.log("Wallet network from adapter:", network);
        
        // Try to detect network from wallet
        if (network) {
          const networkName = network.name || network.toString();
          console.log("Detected wallet network:", networkName);
          setWalletNetwork(networkName.toLowerCase());
          
          if (networkName.toLowerCase().includes('mainnet')) {
            console.log("❌ WALLET IS ON MAINNET!");
            message.error('🚨 Your wallet is connected to MAINNET! Please switch to TESTNET.');
            return;
          } else if (networkName.toLowerCase().includes('testnet')) {
            console.log("✅ WALLET IS ON TESTNET!");
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

  // ✅ VALIDATE WALLET IS ON TESTNET
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

  // ✅ VERIFY TESTNET CONNECTION
  useEffect(() => {
    const verifyTestnetConnection = async () => {
      console.log("🔍 Verifying testnet connection...");
      
      try {
        // Force testnet verification
        const response = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}`);
        const data = await response.json();
        
        if (response.ok) {
          console.log("✅ CONTRACT FOUND ON TESTNET!", data.sequence_number);
          
          // Check for modules
          const modulesResponse = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/modules`);
          const modulesData = await modulesResponse.json();
          console.log("📦 TESTNET Modules:", modulesData.map(m => m.abi?.name || 'unnamed'));
          
          if (modulesData.some(m => m.abi?.name === 'moodmap')) {
            console.log("✅ MOODMAP MODULE VERIFIED ON TESTNET!");
            setNetworkStatus('testnet-verified');
          } else {
            setNetworkStatus('module-not-found');
          }
        }
      } catch (error) {
        console.log("❌ Testnet verification failed:", error);
        setNetworkStatus('testnet-error');
      }
    };

    verifyTestnetConnection();
  }, []);

  const fetchMoodData = async () => {
    if (networkStatus !== 'testnet-verified') return;
    
    setLoading(true);
    try {
      console.log("🔄 Fetching mood data from TESTNET...");
      
      // Force testnet resource check
      try {
        const resource = await aptos.getAccountResource({
          accountAddress: MODULE_ADDRESS,
          resourceType: `${MODULE_ADDRESS}::moodmap::MoodMap`
        });
        
        console.log("✅ MoodMap resource found on testnet:", resource);
        
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
        console.log("Contract resource not found (needs initialization)");
        setTotalEntries(0);
        setMoodData([]);
      }

    } catch (err) {
      console.error("Error fetching mood data:", err);
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
      console.error('Error fetching user mood:', error);
      setUserMood(null);
    }
  };

  const initializeContract = async () => {
    console.log("🔄 Starting contract initialization...");
    
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

    try {
      setLoading(true);
      message.info('Initializing contract on TESTNET...');
      
      // Check if already initialized
      try {
        await aptos.getAccountResource({
          accountAddress: MODULE_ADDRESS,
          resourceType: `${MODULE_ADDRESS}::moodmap::MoodMap`
        });
        message.info('Contract is already initialized!');
        fetchMoodData();
        return;
      } catch (resourceError) {
        console.log("Contract not initialized, proceeding...");
      }
      
      // ✅ FORCE TESTNET TRANSACTION
      const transaction = {
        data: {
          function: `${MODULE_ADDRESS}::moodmap::initialize`,
          typeArguments: [],
          functionArguments: []
        }
      };

      console.log('🚀 Submitting transaction to TESTNET:', transaction);
      console.log('🔗 Expected network: TESTNET');
      console.log('🔗 Wallet network:', walletNetwork);
      
      const response = await signAndSubmitTransaction(transaction);
      console.log('📝 Transaction response:', response);
      
      if (response?.hash) {
        console.log('⏳ Waiting for transaction confirmation...');
        await aptos.waitForTransaction({ transactionHash: response.hash });
        message.success('✅ Contract initialized on TESTNET! 🎉');
        setTimeout(fetchMoodData, 3000);
      }
    } catch (error) {
      console.error("❌ Initialization error:", error);
      
      if (error.message?.includes('mainnet') || error.message?.includes('devnet')) {
        message.error('🚨 WALLET NETWORK MISMATCH! Your wallet is not on TESTNET!');
      } else {
        message.error(`Initialization failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

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

      console.log('🚀 Submitting mood to TESTNET:', transaction);
      const response = await signAndSubmitTransaction(transaction);
      
      if (response?.hash) {
        await aptos.waitForTransaction({ transactionHash: response.hash });
        message.success(`✅ Mood "${selectedMoodData.name}" set on TESTNET! 🎉`);
        setShowMoodModal(false);
        setMoodMessage('');
        setSelectedMoodData(null);
        setTimeout(fetchMoodData, 2000);
      }
    } catch (error) {
      console.error("❌ Error setting mood:", error);
      
      if (error.message?.includes('mainnet') || error.message?.includes('devnet')) {
        message.error('🚨 WALLET NETWORK MISMATCH! Check your wallet network!');
      } else {
        message.error(`Failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

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
            {connected && totalEntries === 0 && networkStatus === 'testnet-verified' && walletNetwork !== 'mainnet' && (
              <Button type="primary" onClick={initializeContract} loading={loading} size="small">
                Initialize Contract
              </Button>
            )}
            <WalletConnector />
          </div>
        </div>
      </Header>

      <Content style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Row gutter={[24, 24]}>
          {/* ✅ CRITICAL: Wallet Network Mismatch Alert */}
          {connected && walletNetwork === 'mainnet' && (
            <Col span={24}>
              <Alert
                message="🚨 CRITICAL: WALLET NETWORK MISMATCH!"
                description={
                  <div style={{ marginTop: '12px' }}>
                    <p><strong>Your wallet is connected to MAINNET but this app requires TESTNET.</strong></p>
                    <p>Contract address <code>{MODULE_ADDRESS}</code> exists on Testnet only.</p>
                    <br />
                    <div style={{ background: '#f6f6f6', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
                      <strong>IMMEDIATE ACTION REQUIRED:</strong>
                      <ol style={{ marginBottom: 0, paddingLeft: '20px' }}>
                        <li><strong>Open Petra Wallet</strong></li>
                        <li><strong>Click the network dropdown at the top</strong></li>
                        <li><strong>Switch from "Mainnet" to "Testnet"</strong></li>
                        <li><strong>Refresh this page</strong></li>
                        <li><strong>Reconnect wallet</strong></li>
                      </ol>
                    </div>
                    <br />
                    <Alert message="⚠️ DO NOT proceed until your wallet shows 'TESTNET'" type="warning" showIcon />
                  </div>
                }
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            </Col>
          )}

          {/* Show content only if wallet is not on mainnet */}
          {walletNetwork !== 'mainnet' && (
            <>
              {networkStatus !== 'testnet-verified' && (
                <Col span={24}>
                  <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
                    <div style={{ color: getNetworkStatusColor(), fontSize: '48px', marginBottom: '16px' }}>
                      {networkStatus === 'checking' ? '🔄' : '❌'}
                    </div>
                    <Title level={3}>{getNetworkStatusText()}</Title>
                    <Text>
                      {networkStatus === 'checking' && "Verifying testnet connection..."}
                      {networkStatus === 'testnet-error' && "Cannot connect to testnet. Check your internet connection."}
                      {networkStatus === 'module-not-found' && "Contract deployed but moodmap module not found."}
                    </Text>
                    {networkStatus !== 'checking' && (
                      <>
                        <br /><br />
                        <Text type="secondary">
                          Contract Address: <code>{MODULE_ADDRESS}</code><br />
                          Expected Network: <strong>Testnet</strong><br />
                          RPC URL: https://fullnode.testnet.aptoslabs.com/v1
                        </Text>
                      </>
                    )}
                  </Card>
                </Col>
              )}

              {networkStatus === 'testnet-verified' && !connected && (
                <Col span={24}>
                  <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
                    <WalletOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                    <Title level={3}>Connect Your Wallet</Title>
                    <Text>Connect your wallet to share your mood and see the community sentiment!</Text>
                    <br /><br />
                    <Text type="secondary">⚠️ Make sure your wallet is set to <strong>Testnet</strong></Text>
                  </Card>
                </Col>
              )}

              {/* Contract initialization */}
              {networkStatus === 'testnet-verified' && connected && totalEntries === 0 && !loading && (
                <Col span={24}>
                  <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
                    <Title level={3}>Initialize MoodMap Contract</Title>
                    <Text>The contract needs to be initialized before you can start tracking moods on testnet.</Text>
                    <br /><br />
                    <Button type="primary" size="large" onClick={initializeContract} loading={loading}>
                      Initialize Contract on TESTNET
                    </Button>
                  </Card>
                </Col>
              )}

              {/* Rest of your app components - Stats, Mood Selection, Charts, etc. */}
              {/* (keeping the rest of your existing JSX here) */}
              
            </>
          )}
        </Row>

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