// src/App.js
import React, { useState, useEffect } from 'react';
import { Layout, Card, Button, message, Row, Col, Typography, Statistic, Input, Modal } from 'antd';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SmileOutlined, FrownOutlined, MehOutlined, WalletOutlined } from '@ant-design/icons';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AppWalletProvider, WalletConnector } from './WalletProvider';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

// Initialize Aptos client for devnet
const aptosConfig = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(aptosConfig);

// Your contract address
const MODULE_ADDRESS = "0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9";

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

  // Fetch global mood data
  const fetchMoodData = async () => {
    setLoading(true);
    try {
      let moodCounts = await aptos.view({
        
          function: `${MODULE_ADDRESS}::moodmap::get_mood_counts`,
          type_arguments: [],
          arguments: []
        
      });

      let total = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::moodmap::get_total_entries`,
          type_arguments: [],
          arguments: []
        }
      });

      setTotalEntries(parseInt(total[0]));
      const chartData = moodOptions.map((mood, i) => ({
        name: mood.name,
        value: parseInt(moodCounts[0][i]),
        emoji: mood.emoji,
        color: mood.color
      })).filter(item => item.value > 0);
      setMoodData(chartData);

      if (connected && account) await fetchUserMood();

    } catch (err) {
      console.error("Error fetching mood data:", err);
      setTotalEntries(0);
      setMoodData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch the connected user's mood
  const fetchUserMood = async () => {
    if (!connected || !account) return;
    try {
      const userAddress = getAccountAddress();
      if (!userAddress) return;

      const userMoodData = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::moodmap::get_user_mood`,
          type_arguments: [],
          arguments: [userAddress]
        }
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

  // Initialize the MoodMap contract
  const initializeContract = async () => {
    if (!connected) {
      message.warning('Please connect your wallet first!');
      return;
    }
    if (!signAndSubmitTransaction || typeof signAndSubmitTransaction !== 'function') {
      message.error('Wallet does not support transaction signing');
      return;
    }
    try {
      setLoading(true);
      message.info('Initializing contract...');
      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::moodmap::initialize`,
        type_arguments: [],
        arguments: []
      };

      const response = await signAndSubmitTransaction(payload);
      if (response && response.hash) {
        await aptos.waitForTransaction({ transactionHash: response.hash });
        message.success('Contract initialized successfully! 🎉');
        setTimeout(fetchMoodData, 2000);
      } else {
        message.error('Transaction failed - no hash received');
      }
    } catch (error) {
      console.error("Error initializing contract:", error);
      if (error.message?.includes('RESOURCE_ALREADY_EXISTS')) {
        message.info('Contract is already initialized!');
        fetchMoodData();
      } else {
        message.error(`Failed to initialize contract: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Set mood modal
  const setMood = async (moodValue) => {
    if (!connected) {
      message.warning('Please connect your wallet first!');
      return;
    }
    setSelectedMoodData({ value: moodValue, name: moodOptions[moodValue].name });
    setShowMoodModal(true);
  };

  // Submit mood to the blockchain
  const submitMood = async () => {
    if (!selectedMoodData || !moodMessage.trim()) {
      message.warning('Please enter a message about your mood!');
      return;
    }
    if (!connected || !signAndSubmitTransaction) {
      message.error('Wallet not connected or cannot sign transactions');
      return;
    }
    try {
      setLoading(true);
      const userAddress = getAccountAddress();
      if (!userAddress) return;

      const messageBytes = Array.from(new TextEncoder().encode(moodMessage));
      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::moodmap::set_mood`,
        type_arguments: [],
        arguments: [selectedMoodData.value, messageBytes]
      };

      const response = await signAndSubmitTransaction(payload);
      if (response && response.hash) {
        await aptos.waitForTransaction({ transactionHash: response.hash });
        message.success(`Mood "${selectedMoodData.name}" set successfully! 🎉`);
        setShowMoodModal(false);
        setMoodMessage('');
        setSelectedMoodData(null);
        setTimeout(fetchMoodData, 2000);
      } else {
        message.error('Transaction failed - no hash received');
      }
    } catch (error) {
      console.error("Error setting mood:", error);
      if (error.message?.includes('E_MOODMAP_NOT_INITIALIZED') || error.message?.includes('RESOURCE_NOT_FOUND')) {
        message.error('Contract not initialized. Please initialize it first.');
      } else {
        message.error(`Failed to set mood: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoodData();
    const interval = setInterval(fetchMoodData, 30000);
    return () => clearInterval(interval);
  }, [connected, account]);

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

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Header style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={2} style={{ color: 'white', margin: 0 }}>🗺️ MoodMap</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {connected && totalEntries === 0 && (
              <Button type="primary" onClick={initializeContract} loading={loading} size="small">Initialize Contract</Button>
            )}
            <WalletConnector />
          </div>
        </div>
      </Header>

      <Content style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Row gutter={[24, 24]}>
          {!connected && (
            <Col span={24}>
              <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
                <WalletOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                <Title level={3}>Connect Your Wallet</Title>
                <Text>Connect your wallet to share your mood and see the community sentiment!</Text>
              </Card>
            </Col>
          )}

          {connected && totalEntries === 0 && !loading && (
            <Col span={24}>
              <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
                <Title level={3}>Initialize MoodMap Contract</Title>
                <Text>The contract needs to be initialized before you can start tracking moods.</Text>
                <br /><br />
                <Button type="primary" size="large" onClick={initializeContract} loading={loading}>Initialize Contract</Button>
              </Card>
            </Col>
          )}

          {connected && userMood && userMood.timestamp > 0 && (
            <Col span={24}>
              <Card title="Your Current Mood" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>{moodOptions[userMood.mood]?.emoji}</div>
                  <Title level={4}>{moodOptions[userMood.mood]?.name}</Title>
                  <Text>"{userMood.message}"</Text>
                  <br />
                  <Text type="secondary">Set on {new Date(userMood.timestamp * 1000).toLocaleString()}</Text>
                </div>
              </Card>
            </Col>
          )}

          <Col span={24}>
            <Card title="How are you feeling right now?" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {moodOptions.map((mood) => (
                  <Button
                    key={mood.value}
                    size="large"
                    type="default"
                    disabled={!connected || totalEntries === 0}
                    onClick={() => setMood(mood.value)}
                    style={{ height: '80px', width: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '24px', borderColor: mood.color, borderWidth: '2px', opacity: (connected && totalEntries > 0) ? 1 : 0.5 }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '4px' }}>{mood.emoji}</div>
                    <div style={{ fontSize: '12px' }}>{mood.name}</div>
                  </Button>
                ))}
              </div>
              {!connected && <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: '16px' }}>Connect wallet to share your mood</Text>}
              {connected && totalEntries === 0 && <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: '16px' }}>Initialize contract first to start tracking moods</Text>}
            </Card>
          </Col>

          <Col span={24}>
            <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
              <Statistic title="Total Mood Entries" value={totalEntries} prefix={<SmileOutlined />} valueStyle={{ color: '#1890ff', fontSize: '32px' }} />
            </Card>
          </Col>

          {moodData.length > 0 && (
            <>
              <Col xs={24} lg={12}>
                <Card title="Mood Distribution" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={moodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value, emoji }) => `${emoji} ${value}`}>
                        {moodData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card title="Mood Counts" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={moodData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="emoji" style={{ fontSize: '20px' }} />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {moodData.map((entry, index) => <Cell key={`bar-${index}`} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </>
          )}

          {moodData.length === 0 && !loading && totalEntries === 0 && connected && (
            <Col span={24}>
              <Card style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', textAlign: 'center', padding: '40px' }}>
                <MehOutlined style={{ fontSize: '64px', color: '#ccc', marginBottom: '16px' }} />
                <Title level={3} style={{ color: '#666' }}>No moods recorded yet</Title>
                <Text style={{ color: '#999' }}>Initialize the contract and be the first to share your mood!</Text>
              </Card>
            </Col>
          )}
        </Row>

        <Modal
          title={selectedMoodData ? `Share your ${selectedMoodData.name} mood` : "Share your mood"}
          open={showMoodModal}
          onOk={submitMood}
          onCancel={() => { setShowMoodModal(false); setMoodMessage(''); setSelectedMoodData(null); }}
          confirmLoading={loading}
          okText="Share Mood"
        >
          {selectedMoodData && (
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>{moodOptions[selectedMoodData.value]?.emoji}</div>
              <Title level={4}>{selectedMoodData.name}</Title>
            </div>
          )}
          <TextArea rows={4} placeholder="Tell us more about how you're feeling... (required)" value={moodMessage} onChange={(e) => setMoodMessage(e.target.value)} maxLength={200} />
          <div style={{ marginTop: '8px', textAlign: 'right' }}><Text type="secondary">{moodMessage.length}/200</Text></div>
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
