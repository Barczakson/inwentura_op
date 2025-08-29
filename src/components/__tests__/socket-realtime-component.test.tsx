/**
 * Real-time Component Tests with Socket.IO
 * 
 * Tests for React components that use Socket.IO for real-time updates.
 * This demonstrates how to test components that integrate with WebSocket connections.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { 
  clearSocketEvents, 
  triggerSocketEvent, 
  socketTestUtils 
} from '../../../__mocks__/socket.io-client';

// Mock the socket.io-client module
jest.mock('socket.io-client');

// Test component that uses Socket.IO
const RealtimeDataComponent = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000/api/socketio');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    newSocket.on('message', (message: any) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('upload-progress', (data: any) => {
      setUploadProgress(data.progress);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const sendMessage = (text: string) => {
    if (socket) {
      socket.emit('message', {
        text,
        senderId: 'test-user',
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <div>
      <div data-testid="connection-status">
        Status: {connectionStatus}
      </div>
      <div data-testid="upload-progress">
        Upload Progress: {uploadProgress}%
      </div>
      <div data-testid="message-count">
        Messages: {messages.length}
      </div>
      <div data-testid="messages">
        {messages.map((msg, index) => (
          <div key={index} data-testid={`message-${index}`}>
            {msg.senderId}: {msg.text}
          </div>
        ))}
      </div>
      <button onClick={() => sendMessage('Hello, World!')} data-testid="send-button">
        Send Message
      </button>
    </div>
  );
};

// Test component for batch updates
const BatchUpdateComponent = () => {
  const [items, setItems] = useState<any[]>([]);
  const [batchCount, setBatchCount] = useState<number>(0);

  useEffect(() => {
    const socket = io('http://localhost:3000/api/socketio');

    socket.on('batch-update', (data: any) => {
      setItems(prev => [...prev, data]);
      setBatchCount(prev => prev + 1);
    });

    socket.on('batch-reset', () => {
      setItems([]);
      setBatchCount(0);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div>
      <div data-testid="batch-count">Batch Count: {batchCount}</div>
      <div data-testid="items-count">Items: {items.length}</div>
      <div data-testid="items">
        {items.map((item, index) => (
          <div key={index} data-testid={`item-${index}`}>
            {item.id}: {item.value}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('Real-time Component Tests', () => {
  beforeEach(() => {
    clearSocketEvents();
  });

  afterEach(() => {
    clearSocketEvents();
  });

  describe('RealtimeDataComponent', () => {
    it('should render with initial disconnected state', () => {
      render(<RealtimeDataComponent />);
      
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Status: disconnected');
      expect(screen.getByTestId('upload-progress')).toHaveTextContent('Upload Progress: 0%');
      expect(screen.getByTestId('message-count')).toHaveTextContent('Messages: 0');
    });

    it('should show connected status when socket connects', async () => {
      render(<RealtimeDataComponent />);
      
      // Simulate connection
      act(() => {
        triggerSocketEvent('connect');
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Status: connected');
      });
    });

    it('should receive and display messages', async () => {
      render(<RealtimeDataComponent />);
      
      // Simulate welcome message
      act(() => {
        triggerSocketEvent('message', {
          text: 'Welcome to WebSocket Echo Server!',
          senderId: 'system',
          timestamp: new Date().toISOString()
        });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('Messages: 1');
        expect(screen.getByTestId('message-0')).toHaveTextContent('system: Welcome to WebSocket Echo Server!');
      });
    });

    it('should update upload progress in real-time', async () => {
      render(<RealtimeDataComponent />);
      
      // Simulate upload progress updates
      const progressValues = [25, 50, 75, 100];
      
      for (const progress of progressValues) {
        act(() => {
          triggerSocketEvent('upload-progress', { progress });
        });
        
        await waitFor(() => {
          expect(screen.getByTestId('upload-progress')).toHaveTextContent(`Upload Progress: ${progress}%`);
        });
      }
    });

    it('should handle multiple messages in sequence', async () => {
      render(<RealtimeDataComponent />);
      
      const messages = [
        { text: 'First message', senderId: 'user1', timestamp: new Date().toISOString() },
        { text: 'Second message', senderId: 'user2', timestamp: new Date().toISOString() },
        { text: 'Third message', senderId: 'user3', timestamp: new Date().toISOString() }
      ];
      
      // Send messages in sequence
      for (const message of messages) {
        act(() => {
          triggerSocketEvent('message', message);
        });
      }
      
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('Messages: 3');
      });
      
      // Verify all messages are displayed
      messages.forEach((message, index) => {
        expect(screen.getByTestId(`message-${index}`)).toHaveTextContent(`${message.senderId}: ${message.text}`);
      });
    });

    it('should send messages when button is clicked', async () => {
      render(<RealtimeDataComponent />);
      
      // Wait for socket to be initialized
      await waitFor(() => {
        expect(io).toHaveBeenCalled();
      });
      
      const sendButton = screen.getByTestId('send-button');
      
      act(() => {
        sendButton.click();
      });
      
      // Verify emit was called on the socket
      const mockSocket = (io as jest.Mock).mock.results[0].value;
      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        text: 'Hello, World!',
        senderId: 'test-user',
        timestamp: expect.any(String)
      });
    });

    it('should handle connection/disconnection cycles', async () => {
      render(<RealtimeDataComponent />);
      
      // Initial state should be disconnected
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Status: disconnected');
      
      // Simulate connection
      act(() => {
        triggerSocketEvent('connect');
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Status: connected');
      });
      
      // Simulate disconnection
      act(() => {
        triggerSocketEvent('disconnect');
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Status: disconnected');
      });
    });
  });

  describe('BatchUpdateComponent', () => {
    it('should render with initial empty state', () => {
      render(<BatchUpdateComponent />);
      
      expect(screen.getByTestId('batch-count')).toHaveTextContent('Batch Count: 0');
      expect(screen.getByTestId('items-count')).toHaveTextContent('Items: 0');
    });

    it('should handle batch updates efficiently', async () => {
      render(<BatchUpdateComponent />);
      
      const batchSize = 100;
      const batchItems = Array.from({ length: batchSize }, (_, i) => ({
        id: i,
        value: `Item ${i}`,
        timestamp: new Date().toISOString()
      }));
      
      // Send batch updates
      act(() => {
        batchItems.forEach(item => {
          triggerSocketEvent('batch-update', item);
        });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('batch-count')).toHaveTextContent(`Batch Count: ${batchSize}`);
        expect(screen.getByTestId('items-count')).toHaveTextContent(`Items: ${batchSize}`);
      });
      
      // Verify first and last items are displayed
      expect(screen.getByTestId('item-0')).toHaveTextContent('0: Item 0');
      expect(screen.getByTestId(`item-${batchSize - 1}`)).toHaveTextContent(`${batchSize - 1}: Item ${batchSize - 1}`);
    });

    it('should handle batch reset', async () => {
      render(<BatchUpdateComponent />);
      
      // Add some items first
      act(() => {
        for (let i = 0; i < 10; i++) {
          triggerSocketEvent('batch-update', { id: i, value: `Item ${i}` });
        }
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('items-count')).toHaveTextContent('Items: 10');
      });
      
      // Reset batch
      act(() => {
        triggerSocketEvent('batch-reset');
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('batch-count')).toHaveTextContent('Batch Count: 0');
        expect(screen.getByTestId('items-count')).toHaveTextContent('Items: 0');
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle rapid updates without memory leaks', async () => {
      render(<RealtimeDataComponent />);
      
      const messageCount = 1000;
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        text: `Message ${i}`,
        senderId: 'performance-test',
        timestamp: new Date().toISOString()
      }));
      
      const startTime = Date.now();
      
      // Send messages rapidly
      act(() => {
        messages.forEach(message => {
          triggerSocketEvent('message', message);
        });
      });
      
      const endTime = Date.now();
      
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent(`Messages: ${messageCount}`);
      });
      
      // Performance check - should handle 1000 messages quickly
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should cleanup socket connection on unmount', () => {
      const { unmount } = render(<RealtimeDataComponent />);
      
      // Get the mock socket instance
      const mockSocket = (io as jest.Mock).mock.results[0].value;
      
      // Verify socket was created
      expect(io).toHaveBeenCalled();
      
      // Unmount component
      unmount();
      
      // Verify disconnect was called
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Error Handling in Components', () => {
    it('should handle socket errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<RealtimeDataComponent />);
      
      // Simulate a socket error
      act(() => {
        socketTestUtils.simulateConnectionError(new Error('Socket connection failed'));
      });
      
      // Component should still be rendered and functional
      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      expect(screen.getByTestId('message-count')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });

    it('should handle malformed message data', async () => {
      render(<RealtimeDataComponent />);
      
      // Send malformed messages
      const malformedMessages = [
        null,
        undefined,
        { text: null, senderId: 'test' },
        { text: 'valid', senderId: null },
        {}
      ];
      
      act(() => {
        malformedMessages.forEach(message => {
          triggerSocketEvent('message', message);
        });
      });
      
      // Component should still function normally
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent(`Messages: ${malformedMessages.length}`);
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle Excel upload progress updates', async () => {
      render(<RealtimeDataComponent />);
      
      const uploadScenario = [
        { progress: 0, status: 'starting', fileName: 'data.xlsx' },
        { progress: 25, status: 'uploading', fileName: 'data.xlsx' },
        { progress: 50, status: 'processing', fileName: 'data.xlsx' },
        { progress: 75, status: 'validating', fileName: 'data.xlsx' },
        { progress: 100, status: 'complete', fileName: 'data.xlsx' }
      ];
      
      for (const update of uploadScenario) {
        act(() => {
          triggerSocketEvent('upload-progress', update);
        });
        
        await waitFor(() => {
          expect(screen.getByTestId('upload-progress')).toHaveTextContent(`Upload Progress: ${update.progress}%`);
        });
      }
    });

    it('should handle concurrent user interactions', async () => {
      render(<RealtimeDataComponent />);
      
      const users = ['user1', 'user2', 'user3'];
      const messagesPerUser = 5;
      
      // Simulate concurrent messages from multiple users
      act(() => {
        users.forEach(user => {
          for (let i = 0; i < messagesPerUser; i++) {
            triggerSocketEvent('message', {
              text: `Message ${i} from ${user}`,
              senderId: user,
              timestamp: new Date().toISOString()
            });
          }
        });
      });
      
      const totalMessages = users.length * messagesPerUser;
      
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent(`Messages: ${totalMessages}`);
      });
      
      // Verify messages from all users are displayed
      users.forEach(user => {
        const userMessages = screen.getAllByText(new RegExp(`${user}:`));
        expect(userMessages).toHaveLength(messagesPerUser);
      });
    });
  });
});