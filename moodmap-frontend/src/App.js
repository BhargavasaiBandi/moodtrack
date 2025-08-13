// src/App.js - FORCE TESTNET OVERRIDE WITH WALLET DETECTION
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

// ✅ TESTNET CONFIGURATION (RECOMMENDED)
const TESTNET_CONFIG = {
  network: Network.TESTNET,
  fullnodeUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
  indexerUrl: 'https://indexer-testnet.staging.gcp.aptosdev.com/v1/graphql',
  faucetUrl: 'https://faucet.testnet.aptoslabs.com'
};

const aptosConfig = new AptosConfig(TESTNET_CONFIG);
const aptos = new Aptos(aptosConfig);

// Force log the actual URLs being used
console.log("🚨 TESTNET CONFIG:");
console.log("Network:", TESTNET_CONFIG.network);
console.log("Fullnode URL:", TESTNET_CONFIG.fullnodeUrl);
console.log("Aptos client URL:", aptos.config.fullnodeUrl);

// Your testnet contract address
const MODULE_ADDRESS = "0x61f562562dd61e1f376c1d5670885f13d7166e84867f6be5b56ba82cb2f59cf3";

const MoodMapContent = () => {
  const { connected, account, signAndSubmitTransaction } = useWallet();
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
  const [walletNetworkDetected, setWalletNetworkDetected] = useState(false);

  const moodOptions = [
    { value: 0, name: 'Terrible', emoji: '😰', color: '#ff4d4f' },
    { value: 1, name: 'Sad', emoji: '😢', color: '#ff7a45' },
    { value: 2, name: 'Neutral', emoji: '😐', color: '#fadb14' },
    { value: 3, name: 'Happy', emoji: '😊', color: '#52c41a' },
    { value: 4, name: 'Ecstatic', emoji: '🤩', color: '#1890ff' }
  ];

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
    try {
      return !!(connected && account && signAndSubmitTransaction && typeof signAndSubmitTransaction === 'function');
    } catch (error) {
      return false;
    }
  };

  // ✅ VERIFY TESTNET CONNECTION ON STARTUP
  useEffect(() => {
    const verifyTestnetConnection = async () => {
      console.log("🔍 Verifying testnet connection...");
      
      try {
        // Test 1: Direct fetch to testnet
        const directResponse = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}`);
        const directData = await directResponse.json();
        
        if (directResponse.ok) {
          console.log("✅ DIRECT TESTNET: Account found", directData.sequence_number);
          
          // Test modules
          const modulesResponse = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/modules`);
          const modulesData = await modulesResponse.json();
          console.log("📦 TESTNET Modules:", modulesData.map(m => m.abi?.name || 'unnamed'));
          
          if (modulesData.some(m => m.abi?.name === 'moodmap')) {
            console.log("✅ MOODMAP MODULE FOUND ON TESTNET!");
            setNetworkStatus('testnet-verified');
            message.success('Contract verified on Testnet! 🎉');
          } else {
            console.log("❌ Moodmap module not found in testnet modules");
            setNetworkStatus('module-not-found');
          }
        }
      } catch (error) {
        console.log("❌ Direct testnet test failed:", error);
        setNetworkStatus('testnet-error');
      }

      // Test 2: Aptos client
      try {
        const ledgerInfo = await aptos.getLedgerInfo();
        console.log("🔗 Aptos client chain ID:", ledgerInfo.chain_id);
        console.log("🔗 Client URL:", aptos.config.fullnodeUrl);
      } catch (error) {
        console.log("❌ Aptos client failed:", error);
      }
    };

    verifyTestnetConnection();
  }, []);

  // Fetch mood data with explicit testnet calls
  const fetchMoodData = async () => {
    setLoading(true);
    try {
      console.log("🔄 Fetching mood data from testnet...");
      
      // Force testnet resource check
      try {
        const resource = await aptos.getAccountResource({
          accountAddress: MODULE_ADDRESS,
          resourceType: `${MODULE_ADDRESS}::moodmap::MoodMap`
        });
        
        console.log("✅ MoodMap resource found:", resource);
        
        // Get mood counts using testnet
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
      if (err.message?.includes('devnet') || err.message?.includes('staging')) {
        message.error("❌ Still connecting to devnet! Check wallet network settings.");
      }
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
    if (!connected || !account || !signAndSubmitTransaction) {
      message.warning('Please connect your wallet first!');
      return;
    }

    if (networkStatus !== 'testnet-verified') {
      message.error('❌ Testnet connection not verified. Check your wallet network!');
      return;
    }

    try {
      setLoading(true);
      message.info('Initializing contract on testnet...');
      
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
      
      const transaction = {
        data: {
          function: `${MODULE_ADDRESS}::moodmap::initialize`,
          typeArguments: [],
          functionArguments: []
        }
      };

      console.log('Initializing on testnet:', transaction);
      const response = await signAndSubmitTransaction(transaction);
      
      if (response?.hash) {
        await aptos.waitForTransaction({ transactionHash: response.hash });
        message.success('Contract initialized on testnet! 🎉');
        setTimeout(fetchMoodData, 3000);
      }
    } catch (error) {
      console.error("Initialization error:", error);
      if (error.message?.includes('devnet') || error.message?.includes('staging')) {
        message.error("❌ Wallet is still on devnet! Switch to testnet in your wallet settings.");
      } else {
        message.error(`Failed: ${error.message}`);
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

      const response = await signAndSubmitTransaction(transaction);
      
      if (response?.hash) {
        await aptos.waitForTransaction({ transactionHash: response.hash });
        message.success(`Mood "${selectedMoodData.name}" set on testnet! 🎉`);
        setShowMoodModal(false);
        setMoodMessage('');
        setSelectedMoodData(null);
        setTimeout(fetchMoodData, 2000);
      }
    } catch (error) {
      console.error("Error setting mood:", error);
      if (error.message?.includes('devnet')) {
        message.error("❌ Still connecting to devnet! Check wallet settings.");
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
            {connected && totalEntries === 0 && networkStatus === 'testnet-verified' && (
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
          {/* CRITICAL: Wallet Network Mismatch Alert */}
          {walletNetworkDetected && walletNetwork === 'mainnet' && (
            <Col span={24}>
              <Alert
                message="🚨 WALLET NETWORK MISMATCH!"
                description={
                  <div style={{ marginTop: '12px' }}>
                    <p><strong>Your wallet is connected to MAINNET but this app requires TESTNET.</strong></p>
                    <p>Your contract address <code>{MODULE_ADDRESS}</code> exists on Testnet only.</p>
                    <br />
                    <div style={{ background: '#f6f6f6', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
                      <strong>How to fix:</strong>
                      <ol style={{ marginBottom: 0, paddingLeft: '20px' }}>
                        <li><strong>Open your wallet (Petra/Martian/etc.)</strong></li>
                        <li><strong>Go to Settings → Network</strong></li>
                        <li><strong>Switch from "Mainnet" to "Testnet"</strong></li>
                        <li><strong>Disconnect and reconnect wallet to this app</strong></li>
                        <li><strong>Refresh this page</strong></li>
                      </ol>
                    </div>
                    <p style={{ marginTop: '12px' }}>
                      <strong>Testnet RPC URL:</strong> <code>https://fullnode.testnet.aptoslabs.com/v1</code>
                    </p>
                  </div>
                }
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            </Col>
          )}

          {/* Show only if wallet network is correct or unknown */}
          {(!walletNetworkDetected || walletNetwork !== 'mainnet') && (
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
                      {networkStatus === 'contract-not-found' && "Contract not found on testnet. Make sure it's deployed."}
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

              {/* Rest of the app content */}
              {networkStatus === 'testnet-verified' && walletNetwork !== 'mainnet' && !connected && (
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
              {networkStatus === 'testnet-verified' && connected && walletNetwork === 'testnet' && totalEntries === 0 && !loading && (
                <Col span={24}>
                  <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
                    <Title level={3}>Initialize MoodMap Contract</Title>
                    <Text>The contract needs to be initialized before you can start tracking moods on testnet.</Text>
                    <br /><br />
                    <Button type="primary" size="large" onClick={initializeContract} loading={loading}>
                      Initialize Contract on Testnet
                    </Button>
                  </Card>
                </Col>
              )}

              {/* Stats Cards */}
              {networkStatus === 'testnet-verified' && connected && walletNetwork === 'testnet' && totalEntries > 0 && (
                <>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                      <Statistic title="Total Moods" value={totalEntries} prefix="🎭" />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                      <Statistic 
                        title="Your Mood" 
                        value={userMood ? moodOptions[userMood.mood].name : "Not set"} 
                        prefix={userMood ? moodOptions[userMood.mood].emoji : "😶"} 
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                      <Statistic 
                        title="Most Common" 
                        value={moodData.length > 0 ? moodData.reduce((prev, current) => (prev.value > current.value) ? prev : current).name : "N/A"} 
                        prefix={moodData.length > 0 ? moodData.reduce((prev, current) => (prev.value > current.value) ? prev : current).emoji : "📊"} 
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                      <Statistic title="Network" value="Testnet" prefix="🌐" />
                    </Card>
                  </Col>
                </>
              )}

              {/* Mood Selection */}
              {networkStatus === 'testnet-verified' && connected && totalEntries > 0 && (
                <Col span={24}>
                  <Card title="How are you feeling today?" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                    <Row gutter={[16, 16]} justify="center">
                      {moodOptions.map((mood) => (
                        <Col key={mood.value} xs={12} sm={8} md={4}>
                          <Button
                            type={selectedMood === mood.value ? "primary" : "default"}
                            size="large"
                            style={{
                              height: '80px',
                              width: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: selectedMood === mood.value ? mood.color : 'white',
                              borderColor: mood.color,
                              color: selectedMood === mood.value ? 'white' : mood.color
                            }}
                            onClick={() => setMood(mood.value)}
                          >
                            <div style={{ fontSize: '24px', marginBottom: '4px' }}>{mood.emoji}</div>
                            <div style={{ fontSize: '12px' }}>{mood.name}</div>
                          </Button>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                </Col>
              )}

              {/* Charts */}
              {networkStatus === 'testnet-verified' && connected && moodData.length > 0 && (
                <>
                  <Col xs={24} lg={12}>
                    <Card title="Community Mood Distribution" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={moodData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
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
                    <Card title="Mood Count" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={moodData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" fill="#8884d8">
                            {moodData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                </>
              )}

              {/* User's Current Mood */}
              {networkStatus === 'testnet-verified' && connected && userMood && (
                <Col span={24}>
                  <Card title="Your Current Mood" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ fontSize: '48px' }}>{moodOptions[userMood.mood].emoji}</div>
                      <div style={{ flex: 1 }}>
                        <Title level={4} style={{ margin: 0, color: moodOptions[userMood.mood].color }}>
                          {moodOptions[userMood.mood].name}
                        </Title>
                        <Text type="secondary">"{userMood.message}"</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Set on {new Date(userMood.timestamp * 1000).toLocaleString()}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              )}
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
          okText="Share Mood on Testnet"
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