// src/App.js - SIMPLIFIED VERSION - No Manual Initialization
import React, { useState, useEffect } from 'react';
import { Layout, Card, Button, message, Row, Col, Typography, Statistic, Input, Modal, Alert, Spin } from 'antd';
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
  const [userMood, setUserMood] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMoodData, setSelectedMoodData] = useState(null);
  const [networkStatus, setNetworkStatus] = useState('checking');
  const [walletNetwork, setWalletNetwork] = useState('unknown');
  const [isFetchingStats, setIsFetchingStats] = useState(false);

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
        if (network) {
          const networkName = network.name || network.toString();
          setWalletNetwork(networkName.toLowerCase());
          
          if (networkName.toLowerCase().includes('mainnet')) {
            message.error('🚨 Your wallet is connected to MAINNET! Please switch to TESTNET.');
            return;
          } else if (networkName.toLowerCase().includes('testnet')) {
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

  // ✅ SIMPLIFIED TESTNET VERIFICATION
  useEffect(() => {
    const verifyTestnetConnection = async () => {
      try {
        const response = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}`);
        
        if (response.ok) {
          const modulesResponse = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/modules`);
          const modulesData = await modulesResponse.json();
          
          if (modulesData.some(m => m.abi?.name === 'moodmap')) {
            setNetworkStatus('testnet-verified');
          } else {
            setNetworkStatus('module-not-found');
          }
        }
      } catch (error) {
        setNetworkStatus('testnet-error');
      }
    };

    verifyTestnetConnection();
  }, []);

  const fetchMoodData = async () => {
    if (networkStatus !== 'testnet-verified') return;
    
    setIsFetchingStats(true);
    setLoading(true);
    try {
      console.log('🔄 Fetching mood data from contract...');
      
      // ✅ FIXED: Safer data fetching with better error handling
      let moodCounts, total;
      
      try {
        moodCounts = await aptos.view({
          payload: {
            function: `${MODULE_ADDRESS}::moodmap::get_mood_counts`,
            type_arguments: [],
            arguments: []
          }
        });
        console.log('📊 Raw mood counts from contract:', moodCounts);
        console.log('📊 Type of mood counts:', typeof moodCounts, Array.isArray(moodCounts));
      } catch (err) {
        console.log('❌ Error fetching mood counts:', err.message);
        throw err;
      }
      
      try {
        total = await aptos.view({
          payload: {
            function: `${MODULE_ADDRESS}::moodmap::get_total_entries`,
            type_arguments: [],
            arguments: []
          }
        });
        console.log('📊 Raw total entries from contract:', total);
        console.log('📊 Type of total:', typeof total, Array.isArray(total));
      } catch (err) {
        console.log('❌ Error fetching total entries:', err.message);
        throw err;
      }

      // ✅ SAFER PARSING: Handle different data formats
      let totalEntries = 0;
      let countsArray = [0, 0, 0, 0, 0]; // Default to all zeros

      // Parse total entries safely
      if (total !== undefined && total !== null) {
        if (Array.isArray(total)) {
          totalEntries = parseInt(total[0]) || 0;
        } else {
          totalEntries = parseInt(total) || 0;
        }
      }

      // Parse mood counts safely
      if (moodCounts !== undefined && moodCounts !== null) {
        if (Array.isArray(moodCounts)) {
          if (Array.isArray(moodCounts[0])) {
            // Double nested array
            countsArray = moodCounts[0].map(count => parseInt(count) || 0);
          } else {
            // Single array
            countsArray = moodCounts.map(count => parseInt(count) || 0);
          }
        } else {
          console.warn('⚠️ Unexpected mood counts format:', moodCounts);
        }
      }
      
      console.log('📊 Parsed total entries:', totalEntries);
      console.log('📊 Parsed counts array:', countsArray);

      setTotalEntries(totalEntries);
      
      const chartData = moodOptions.map((mood, i) => ({
        name: mood.name,
        value: countsArray[i] || 0,
        emoji: mood.emoji,
        color: mood.color
      }));
      
      console.log('📊 Chart data created:', chartData);
      setMoodData(chartData);

      if (isWalletReady()) await fetchUserMood();

      // ✅ SUCCESS MESSAGE
      if (totalEntries > 0) {
        console.log(`✅ Successfully loaded ${totalEntries} mood entries from contract!`);
      }

    } catch (err) {
      console.log(`❌ Error fetching mood data: ${err.message}`);
      console.log('❌ Full error object:', err);
      
      // ✅ If contract not initialized, show helpful message
      if (err.message?.includes('E_MOODMAP_NOT_INITIALIZED') || 
          err.message?.includes('resource not found')) {
        message.info('Contract not initialized yet. Set the first mood to get started!');
      } else {
        message.error(`Error loading data: ${err.message}`);
      }
      setTotalEntries(0);
      setMoodData(moodOptions.map(mood => ({ ...mood, value: 0 })));
    } finally {
      setLoading(false);
      setIsFetchingStats(false);
    }
  };

  const fetchUserMood = async () => {
    if (!isWalletReady()) return;
    
    try {
      const userAddress = getAccountAddress();
      if (!userAddress) return;

      console.log('👤 Fetching user mood for:', userAddress);

      const userMoodData = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::moodmap::get_user_mood`,
          type_arguments: [],
          arguments: [userAddress]
        }
      });

      console.log('👤 Raw user mood data:', userMoodData);

      if (userMoodData && userMoodData[0] !== undefined) {
        // ✅ IMPROVED: Handle message as bytes array
        let message = userMoodData[1];
        if (Array.isArray(message)) {
          // Convert bytes array back to string
          message = new TextDecoder().decode(new Uint8Array(message));
        }
        
        const moodData = {
          mood: parseInt(userMoodData[0]),
          message: message,
          timestamp: parseInt(userMoodData[2])
        };
        
        console.log('👤 Parsed user mood:', moodData);
        setUserMood(moodData);
      }
    } catch (error) {
      console.log(`❌ Error fetching user mood: ${error.message}`);
      setUserMood(null);
    }
  };

  // ✅ SIMPLIFIED: Just set mood, no initialization checks
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
      
      console.log('🚀 Submitting mood:', selectedMoodData.name);
      console.log('📝 Message bytes:', messageBytes);
      
      const transaction = {
        data: {
          function: `${MODULE_ADDRESS}::moodmap::set_mood`,
          typeArguments: [],
          functionArguments: [selectedMoodData.value, messageBytes]
        }
      };

      console.log('Submitting transaction:', transaction);
      const response = await signAndSubmitTransaction(transaction);
      console.log('Transaction response:', response);
      
      if (response?.hash) {
        console.log('⏳ Waiting for transaction:', response.hash);
        await aptos.waitForTransaction({ transactionHash: response.hash });
        
        // ✅ IMPROVED SUCCESS MESSAGE
        message.success({
          content: (
            <div>
              <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                🎉 Mood Successfully Submitted!
              </div>
              <div style={{ fontSize: '14px' }}>
                {selectedMoodData.name} mood: "{moodMessage}"
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Transaction: {response.hash.slice(0, 8)}...
              </div>
            </div>
          ),
          duration: 5
        });
        
        setShowMoodModal(false);
        setMoodMessage('');
        setSelectedMoodData(null);
        
        // ✅ IMMEDIATE DATA REFRESH
        console.log('🔄 Refreshing data after successful submission...');
        setTimeout(() => {
          fetchMoodData();
        }, 1000);
        
        // ✅ ALSO REFRESH AGAIN AFTER A DELAY TO ENSURE DATA IS UPDATED
        setTimeout(() => {
          fetchMoodData();
        }, 3000);
      }
    } catch (error) {
      console.error('Full error object in submitMood:', error);
      console.log(`❌ Error setting mood: ${error.message}`);
      
      // ✅ SIMPLIFIED ERROR HANDLING
      if (error.message?.includes('E_MOODMAP_NOT_INITIALIZED') || 
          error.message?.includes('MOODMAP_NOT_INITIALIZED') ||
          error.message?.includes('resource not found')) {
        
        message.error('❌ Contract not initialized! Please run the initialization command first.');
        setShowMoodModal(false);
        
      } else if (error.message?.includes('mainnet') || error.message?.includes('devnet')) {
        message.error('🚨 WALLET NETWORK MISMATCH! Check your wallet network!');
      } else {
        message.error(`Failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ SIMPLIFIED: Auto-fetch data when connected
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

  // ✅ SIMPLIFIED: Show interface when testnet is verified and wallet connected
  const shouldShowInterface = () => {
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
            <WalletConnector />
          </div>
        </div>
      </Header>

      <Content style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Row gutter={[24, 24]}>
          
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

              {/* ✅ MAIN INTERFACE - Show when ready */}
              {shouldShowInterface() && (
                <>
                  {/* Stats Row with Refresh Button */}
                  <Col span={24}>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={6}>
                        <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none' }}>
                          <Statistic 
                            title="Total Mood Entries" 
                            loading={isFetchingStats}
                            value={totalEntries} 
                            prefix={<SmileOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={6}>
                        <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none' }}>
                          <Statistic 
                            title="Community Moods" 
                            loading={isFetchingStats}
                            value={moodData.filter(m => m.value > 0).length} 
                            prefix={<MehOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={6}>
                        <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none' }}>
                          <Statistic 
                            title="Your Mood Status" 
                            loading={isFetchingStats}
                            value={userMood ? moodOptions[userMood.mood]?.name : 'Not Set'} 
                            prefix={userMood ? moodOptions[userMood.mood]?.emoji : '❓'}
                            valueStyle={{ color: userMood ? moodOptions[userMood.mood]?.color : '#999' }}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} sm={6}>
                        <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none', textAlign: 'center' }}>
                          <Button 
                            type="primary" 
                            icon="🔄"
                            onClick={() => {
                              console.log('🔄 Manual refresh triggered');
                              fetchMoodData();
                            }}
                            loading={loading}
                            style={{ width: '100%' }}
                          >
                            Refresh Data
                          </Button>
                        </Card>
                      </Col>
                    </Row>
                  </Col>

                  {/* ✅ SIMPLIFIED EMOJI SELECTION */}
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

                  {/* Charts (show even if empty for debugging) */}
                  <Col span={24}>
                    <Row gutter={[24, 24]}>
                      <Col xs={24} lg={12}>
                        <Card 
                          title={`Community Mood Distribution (Total: ${totalEntries})`}
                          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}
                        >
                          {moodData.filter(item => item.value > 0).length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={moodData.filter(item => item.value > 0)}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={120}
                                  dataKey="value"
                                  label={({ name, value, emoji }) => `${emoji} ${name}: ${value}`}
                                >
                                  {moodData.filter(item => item.value > 0).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                              <Text type="secondary">
                                {totalEntries === 0 ? 'No moods submitted yet. Be the first!' : 'Loading mood data...'}
                              </Text>
                            </div>
                          )}
                        </Card>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Card 
                          title="Mood Counts (All Categories)" 
                          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}
                        >
                          {moodData.some(item => item.value > 0) ? (
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={moodData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="emoji" />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" fill="#1890ff" />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
                              <Text type="secondary">
                                {totalEntries === 0 ? 'No data to display yet.' : 'Loading chart data...'}
                              </Text>
                            </div>
                          )}
                          
                          {/* ✅ DEBUG INFO */}
                          <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
                            <div><strong>Debug Info:</strong></div>
                            {moodData.map((mood, i) => (
                              <div key={i}>
                                {mood.emoji} {mood.name}: {mood.value} entries
                              </div>
                            ))}
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  </Col>

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