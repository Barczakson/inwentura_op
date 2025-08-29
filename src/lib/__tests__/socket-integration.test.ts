/**
 * Socket.IO Integration Tests
 * 
 * Comprehensive test suite for Socket.IO functionality including:
 * - Connection/disconnection scenarios
 * - Message handling and broadcasting
 * - Error handling and recovery
 * - Real-time event processing
 */

import { setupSocket } from '@/lib/socket';
import { Server } from 'socket.io';
import { 
  socketServerTestUtils, 
  simulateClientMessage, 
  clearServerState,
  triggerServerEvent 
} from '../../../__mocks__/socket.io';

// Mock the Socket.IO module
import mockSocketIO from '../../../__mocks__/socket.io';
jest.mock('socket.io', () => mockSocketIO);

describe('Socket.IO Integration Tests', () => {
  let mockServer: any;
  let mockSocket: any;

  beforeEach(() => {
    // Clear any previous state
    clearServerState();
    
    // Create a fresh server instance
    mockServer = new Server();
    
    // Setup our socket handlers
    setupSocket(mockServer);
  });

  afterEach(() => {
    clearServerState();
  });

  describe('Server Setup and Configuration', () => {
    it('should initialize server with connection handler', () => {
      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(socketServerTestUtils.hasServerEventListeners('connection')).toBe(true);
    });

    it('should handle setupSocket function without errors', () => {
      expect(() => setupSocket(mockServer)).not.toThrow();
    });
  });

  describe('Client Connection Management', () => {
    it('should handle client connection and send welcome message', async () => {
      // Simulate a client connection
      const socket = socketServerTestUtils.connectClient('test-client-1');
      
      // Verify connection was registered
      expect(socket.id).toBe('test-client-1');
      expect(socket.emit).toHaveBeenCalledWith('message', {
        text: 'Welcome to WebSocket Echo Server!',
        senderId: 'system',
        timestamp: expect.any(String),
      });
    });

    it('should handle multiple concurrent connections', async () => {
      const clientCount = 5;
      const sockets = socketServerTestUtils.connectMultipleClients(clientCount);
      
      // Verify all clients are connected
      expect(sockets).toHaveLength(clientCount);
      expect(socketServerTestUtils.getAllConnectedSockets()).toHaveLength(clientCount);
      
      // Verify each client received welcome message
      sockets.forEach(socket => {
        expect(socket.emit).toHaveBeenCalledWith('message', {
          text: 'Welcome to WebSocket Echo Server!',
          senderId: 'system',
          timestamp: expect.any(String),
        });
      });
    });

    it('should handle client disconnection properly', () => {
      const socket = socketServerTestUtils.connectClient('test-disconnect');
      
      // Verify socket is connected
      expect(socketServerTestUtils.getAllConnectedSockets()).toHaveLength(1);
      
      // Simulate disconnection
      socket.disconnect();
      
      // Verify socket was removed from connected sockets
      expect(socketServerTestUtils.getAllConnectedSockets()).toHaveLength(0);
    });
  });

  describe('Message Handling and Echo Functionality', () => {
    it('should echo messages back to sender', () => {
      const socket = socketServerTestUtils.connectClient('echo-test');
      const testMessage = {
        text: 'Hello, World!',
        senderId: 'test-user'
      };
      
      // Simulate client sending a message
      simulateClientMessage('echo-test', 'message', testMessage);
      
      // Verify echo response was sent
      expect(socket.emit).toHaveBeenCalledWith('message', {
        text: `Echo: ${testMessage.text}`,
        senderId: 'system',
        timestamp: expect.any(String),
      });
    });

    it('should handle empty or malformed messages gracefully', () => {
      const socket = socketServerTestUtils.connectClient('malformed-test');
      
      // Test various malformed message scenarios
      const malformedMessages = [
        { text: '', senderId: 'test' }, // Empty text
        { text: null, senderId: 'test' }, // Null text
        { senderId: 'test' }, // Missing text
        { text: 'valid' }, // Missing senderId
        {}, // Empty object
        null, // Null message
        undefined // Undefined message
      ];
      
      malformedMessages.forEach((message, index) => {
        expect(() => {
          simulateClientMessage('malformed-test', 'message', message);
        }).not.toThrow();
      });
    });

    it('should handle messages with special characters and Unicode', () => {
      const socket = socketServerTestUtils.connectClient('unicode-test');
      const specialMessages = [
        { text: '🚀 Rocket emoji test', senderId: 'emoji-user' },
        { text: 'Special chars: !@#$%^&*()', senderId: 'special-user' },
        { text: 'Unicode: ñáéíóúüç', senderId: 'unicode-user' },
        { text: 'Very long message: ' + 'a'.repeat(1000), senderId: 'long-user' }
      ];
      
      specialMessages.forEach(message => {
        simulateClientMessage('unicode-test', 'message', message);
        expect(socket.emit).toHaveBeenCalledWith('message', {
          text: `Echo: ${message.text}`,
          senderId: 'system',
          timestamp: expect.any(String),
        });
      });
    });
  });

  describe('Event Handling and Listeners', () => {
    it('should register message event listeners for connected clients', () => {
      const socket = socketServerTestUtils.connectClient('event-test');
      
      // Verify message event listener was registered
      expect(socket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should handle disconnect events properly', () => {
      const socket = socketServerTestUtils.connectClient('disconnect-event-test');
      
      // Verify disconnect handler is registered
      expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      
      // Simulate disconnect event
      socket.disconnect();
      
      // Verify socket was cleaned up (tested by checking connected sockets count)
      expect(socketServerTestUtils.getAllConnectedSockets()).toHaveLength(0);
    });
  });

  describe('Real-time Communication Scenarios', () => {
    it('should handle rapid message exchanges', () => {
      const socket = socketServerTestUtils.connectClient('rapid-test');
      const messageCount = 100;
      
      // Send multiple messages rapidly
      for (let i = 0; i < messageCount; i++) {
        simulateClientMessage('rapid-test', 'message', {
          text: `Message ${i}`,
          senderId: 'rapid-user'
        });
      }
      
      // Verify all messages were echoed (including welcome message)
      expect(socket.emit).toHaveBeenCalledTimes(messageCount + 1);
    });

    it('should maintain message order and integrity', () => {
      const socket = socketServerTestUtils.connectClient('order-test');
      const messages = [
        { text: 'First message', senderId: 'user1' },
        { text: 'Second message', senderId: 'user2' },
        { text: 'Third message', senderId: 'user3' }
      ];
      
      // Send messages in order
      messages.forEach((message, index) => {
        simulateClientMessage('order-test', 'message', message);
      });
      
      // Verify messages were echoed in correct order
      messages.forEach((message, index) => {
        expect(socket.emit).toHaveBeenNthCalledWith(index + 2, 'message', { // +2 to account for welcome message
          text: `Echo: ${message.text}`,
          senderId: 'system',
          timestamp: expect.any(String),
        });
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle server errors gracefully', () => {
      const socket = socketServerTestUtils.connectClient('error-test');
      
      // Mock console.error to test error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Simulate an error scenario - force an exception in message handler
      const originalEmit = socket.emit;
      socket.emit.mockImplementationOnce(() => {
        throw new Error('Simulated socket error');
      });
      
      // This should not crash the server
      expect(() => {
        simulateClientMessage('error-test', 'message', {
          text: 'Error test',
          senderId: 'error-user'
        });
      }).not.toThrow();
      
      // Restore original functionality
      socket.emit = originalEmit;
      
      consoleSpy.mockRestore();
    });

    it('should handle client disconnection during message processing', () => {
      const socket = socketServerTestUtils.connectClient('disconnect-during-message');
      
      // Simulate client disconnecting while processing a message
      socket.disconnect();
      
      // Try to send a message after disconnection
      expect(() => {
        simulateClientMessage('disconnect-during-message', 'message', {
          text: 'Message after disconnect',
          senderId: 'disconnected-user'
        });
      }).not.toThrow();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle many simultaneous connections efficiently', () => {
      const connectionCount = 50;
      const startTime = Date.now();
      
      // Create many connections
      const sockets = socketServerTestUtils.connectMultipleClients(connectionCount);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify all connections were created
      expect(sockets).toHaveLength(connectionCount);
      expect(socketServerTestUtils.getAllConnectedSockets()).toHaveLength(connectionCount);
      
      // Performance check - should handle 50 connections quickly (under 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle high message throughput', () => {
      const socket = socketServerTestUtils.connectClient('throughput-test');
      const messageCount = 1000;
      const startTime = Date.now();
      
      // Send many messages
      for (let i = 0; i < messageCount; i++) {
        simulateClientMessage('throughput-test', 'message', {
          text: `Throughput test message ${i}`,
          senderId: 'throughput-user'
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify all messages were processed
      expect(socket.emit).toHaveBeenCalledTimes(messageCount + 1); // +1 for welcome message
      
      // Performance check - should handle 1000 messages quickly (under 200ms)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Timestamp and Data Integrity', () => {
    it('should include valid ISO timestamps in messages', () => {
      const socket = socketServerTestUtils.connectClient('timestamp-test');
      
      simulateClientMessage('timestamp-test', 'message', {
        text: 'Timestamp test',
        senderId: 'timestamp-user'
      });
      
      // Get the last emitted message
      const lastCall = socket.emit.mock.calls[socket.emit.mock.calls.length - 1];
      const messageData = lastCall[1];
      
      // Verify timestamp is valid ISO string
      expect(messageData.timestamp).toBeDefined();
      expect(new Date(messageData.timestamp).toISOString()).toBe(messageData.timestamp);
      
      // Verify timestamp is recent (within last second)
      const timestampAge = Date.now() - new Date(messageData.timestamp).getTime();
      expect(timestampAge).toBeLessThan(1000);
    });

    it('should preserve message data integrity', () => {
      const socket = socketServerTestUtils.connectClient('integrity-test');
      const originalMessage = {
        text: 'Data integrity test with special chars: !@#$%^&*()_+{}[]|\\:";\'<>?,./',
        senderId: 'integrity-user'
      };
      
      simulateClientMessage('integrity-test', 'message', originalMessage);
      
      // Verify echoed message contains expected data
      expect(socket.emit).toHaveBeenCalledWith('message', {
        text: `Echo: ${originalMessage.text}`,
        senderId: 'system',
        timestamp: expect.any(String),
      });
    });
  });
});