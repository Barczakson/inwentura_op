/**
 * Socket.IO Client-Side Tests
 * 
 * Comprehensive test suite for client-side Socket.IO functionality including:
 * - Connection establishment and management
 * - Event emission and listening
 * - Error handling and reconnection logic
 * - Real-time data updates
 */

import { io } from 'socket.io-client';
import { 
  clearSocketEvents, 
  triggerSocketEvent, 
  getMockSocketInstance,
  socketTestUtils 
} from '../../../__mocks__/socket.io-client';

// Mock the socket.io-client module
jest.mock('socket.io-client');

describe('Socket.IO Client Tests', () => {
  let socket: any;

  beforeEach(() => {
    clearSocketEvents();
    socket = io('http://localhost:3000/api/socketio');
  });

  afterEach(() => {
    if (socket) {
      socket.disconnect();
    }
    clearSocketEvents();
  });

  describe('Connection Management', () => {
    it('should establish connection to server', () => {
      expect(io).toHaveBeenCalledWith('http://localhost:3000/api/socketio');
      expect(socket).toBeDefined();
      expect(socket.id).toBe('mock-socket-id');
    });

    it('should handle connection events', (done) => {
      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        expect(socket.disconnected).toBe(false);
        done();
      });
      
      socket.connect();
    });

    it('should handle disconnection events', (done) => {
      // First establish connection
      socket.connect();
      
      socket.on('disconnect', () => {
        expect(socket.connected).toBe(false);
        expect(socket.disconnected).toBe(true);
        done();
      });
      
      socket.disconnect();
    });

    it('should handle reconnection scenarios', (done) => {
      let connectCount = 0;
      
      socket.on('connect', () => {
        connectCount++;
        if (connectCount === 1) {
          // First connection
          socket.disconnect();
        } else if (connectCount === 2) {
          // Reconnection
          expect(socket.connected).toBe(true);
          done();
        }
      });
      
      socket.on('disconnect', () => {
        // Simulate reconnection
        setTimeout(() => socket.connect(), 10);
      });
      
      socket.connect();
    });
  });

  describe('Message Handling', () => {
    it('should receive welcome message on connection', (done) => {
      socket.on('message', (message: any) => {
        if (message.text.includes('Welcome')) {
          expect(message.text).toContain('Welcome to WebSocket Echo Server!');
          expect(message.senderId).toBe('system');
          expect(message.timestamp).toBeDefined();
          done();
        }
      });
      
      socket.connect();
    });

    it('should send messages to server', () => {
      const testMessage = {
        text: 'Hello, Server!',
        senderId: 'test-client'
      };
      
      socket.emit('message', testMessage);
      
      expect(socket.emit).toHaveBeenCalledWith('message', testMessage);
    });

    it('should receive echo responses from server', (done) => {
      const testMessage = {
        text: 'Echo test message',
        senderId: 'echo-client'
      };
      
      socket.on('message', (message: any) => {
        if (message.text.startsWith('Echo:')) {
          expect(message.text).toBe(`Echo: ${testMessage.text}`);
          expect(message.senderId).toBe('system');
          expect(message.timestamp).toBeDefined();
          done();
        }
      });
      
      // Simulate server echo response
      setTimeout(() => {
        socketTestUtils.sendServerMessage({
          text: `Echo: ${testMessage.text}`,
          senderId: 'system'
        });
      }, 10);
      
      socket.emit('message', testMessage);
    });

    it('should handle multiple message types', () => {
      const messageTypes = ['message', 'notification', 'update', 'alert'];
      const handlers: { [key: string]: jest.Mock } = {};
      
      messageTypes.forEach(type => {
        handlers[type] = jest.fn();
        socket.on(type, handlers[type]);
      });
      
      // Trigger each message type
      messageTypes.forEach(type => {
        triggerSocketEvent(type, { type, data: `Test ${type}` });
      });
      
      // Verify all handlers were called
      messageTypes.forEach(type => {
        expect(handlers[type]).toHaveBeenCalledWith({ type, data: `Test ${type}` });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', (done) => {
      const testError = new Error('Connection failed');
      
      socket.on('connect_error', (error: Error) => {
        expect(error.message).toBe('Connection failed');
        done();
      });
      
      socketTestUtils.simulateConnectionError(testError);
    });

    it('should handle network timeouts', (done) => {
      const timeoutError = new Error('Network timeout');
      
      socket.on('connect_error', (error: Error) => {
        expect(error.message).toBe('Network timeout');
        done();
      });
      
      socketTestUtils.simulateConnectionError(timeoutError);
    });

    it('should retry connection on failure', (done) => {
      let errorCount = 0;
      
      socket.on('connect_error', () => {
        errorCount++;
        if (errorCount < 3) {
          // Simulate retry
          setTimeout(() => socket.connect(), 100);
        }
      });
      
      socket.on('reconnect', () => {
        expect(errorCount).toBeGreaterThan(0);
        done();
      });
      
      // Simulate initial connection failure
      socketTestUtils.simulateConnectionError(new Error('Initial connection failed'));
      
      // Simulate successful reconnection after some failures
      setTimeout(() => {
        socketTestUtils.simulateReconnection();
      }, 350);
    });
  });

  describe('Event Listener Management', () => {
    it('should add and remove event listeners', () => {
      const handler = jest.fn();
      
      // Add listener
      socket.on('test-event', handler);
      expect(socketTestUtils.hasEventListeners('test-event')).toBe(true);
      
      // Trigger event
      triggerSocketEvent('test-event', { data: 'test' });
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
      
      // Remove listener
      socket.off('test-event', handler);
      
      // Verify listener was removed by triggering again
      handler.mockClear();
      triggerSocketEvent('test-event', { data: 'test2' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove all listeners for an event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      socket.on('multi-handler-event', handler1);
      socket.on('multi-handler-event', handler2);
      
      // Verify both handlers are registered
      const listeners = socketTestUtils.getEventListeners('multi-handler-event');
      expect(listeners).toHaveLength(2);
      
      // Remove all listeners
      socket.off('multi-handler-event');
      
      // Verify no listeners remain
      expect(socketTestUtils.hasEventListeners('multi-handler-event')).toBe(false);
    });

    it('should remove all listeners on removeAllListeners call', () => {
      socket.on('event1', jest.fn());
      socket.on('event2', jest.fn());
      socket.on('event3', jest.fn());
      
      expect(socketTestUtils.hasEventListeners('event1')).toBe(true);
      expect(socketTestUtils.hasEventListeners('event2')).toBe(true);
      expect(socketTestUtils.hasEventListeners('event3')).toBe(true);
      
      socket.removeAllListeners();
      
      expect(socketTestUtils.hasEventListeners('event1')).toBe(false);
      expect(socketTestUtils.hasEventListeners('event2')).toBe(false);
      expect(socketTestUtils.hasEventListeners('event3')).toBe(false);
    });
  });

  describe('Real-time Data Updates', () => {
    it('should handle upload progress updates', (done) => {
      const progressData = {
        uploadId: 'test-upload-123',
        progress: 75,
        fileName: 'test-file.xlsx',
        status: 'processing'
      };
      
      socket.on('upload-progress', (data: any) => {
        expect(data.uploadId).toBe(progressData.uploadId);
        expect(data.progress).toBe(progressData.progress);
        expect(data.fileName).toBe(progressData.fileName);
        expect(data.status).toBe(progressData.status);
        done();
      });
      
      triggerSocketEvent('upload-progress', progressData);
    });

    it('should handle data synchronization events', (done) => {
      const syncData = {
        type: 'DATA_SYNC',
        table: 'excel_files',
        operation: 'INSERT',
        data: {
          id: 'new-file-id',
          filename: 'new-data.xlsx',
          status: 'processed'
        }
      };
      
      socket.on('data-sync', (data: any) => {
        expect(data.type).toBe(syncData.type);
        expect(data.table).toBe(syncData.table);
        expect(data.operation).toBe(syncData.operation);
        expect(data.data).toEqual(syncData.data);
        done();
      });
      
      triggerSocketEvent('data-sync', syncData);
    });

    it('should handle batch data updates efficiently', () => {
      const updates: any[] = [];
      const batchSize = 100;
      
      socket.on('batch-update', (data: any) => {
        updates.push(data);
      });
      
      // Send batch updates
      for (let i = 0; i < batchSize; i++) {
        triggerSocketEvent('batch-update', {
          id: i,
          value: `Update ${i}`,
          timestamp: new Date().toISOString()
        });
      }
      
      expect(updates).toHaveLength(batchSize);
      expect(updates[0].id).toBe(0);
      expect(updates[batchSize - 1].id).toBe(batchSize - 1);
    });
  });

  describe('Acknowledgments and Callbacks', () => {
    it('should handle message acknowledgments', (done) => {
      const testMessage = {
        text: 'Message requiring acknowledgment',
        senderId: 'ack-client'
      };
      
      socket.emit('message', testMessage, (response: any) => {
        expect(response.success).toBe(true);
        done();
      });
    });

    it('should timeout acknowledgments appropriately', (done) => {
      let ackReceived = false;
      
      socket.emit('message', { text: 'Timeout test', senderId: 'timeout-client' }, (response: any) => {
        ackReceived = true;
        expect(response.success).toBe(true);
      });
      
      // Verify acknowledgment is received quickly
      setTimeout(() => {
        expect(ackReceived).toBe(true);
        done();
      }, 50);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle rapid event registration and removal without memory leaks', () => {
      const eventCount = 1000;
      const handlers: jest.Mock[] = [];
      
      // Register many handlers
      for (let i = 0; i < eventCount; i++) {
        const handler = jest.fn();
        handlers.push(handler);
        socket.on(`event-${i}`, handler);
      }
      
      // Verify all handlers are registered
      for (let i = 0; i < eventCount; i++) {
        expect(socketTestUtils.hasEventListeners(`event-${i}`)).toBe(true);
      }
      
      // Remove all handlers
      for (let i = 0; i < eventCount; i++) {
        socket.off(`event-${i}`, handlers[i]);
      }
      
      // Verify all handlers are removed
      for (let i = 0; i < eventCount; i++) {
        expect(socketTestUtils.hasEventListeners(`event-${i}`)).toBe(false);
      }
    });

    it('should handle high-frequency events without performance degradation', () => {
      let eventCount = 0;
      const startTime = Date.now();
      
      socket.on('high-frequency-event', () => {
        eventCount++;
      });
      
      // Trigger many events rapidly
      const totalEvents = 10000;
      for (let i = 0; i < totalEvents; i++) {
        triggerSocketEvent('high-frequency-event', { index: i });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(eventCount).toBe(totalEvents);
      // Should handle 10k events in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle events with null or undefined data', () => {
      const handler = jest.fn();
      socket.on('null-data-event', handler);
      
      // Test various null/undefined scenarios
      triggerSocketEvent('null-data-event', null);
      triggerSocketEvent('null-data-event', undefined);
      triggerSocketEvent('null-data-event');
      
      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenNthCalledWith(1, null);
      expect(handler).toHaveBeenNthCalledWith(2, undefined);
      expect(handler).toHaveBeenNthCalledWith(3, undefined);
    });

    it('should handle events with very large payloads', () => {
      const handler = jest.fn();
      socket.on('large-payload-event', handler);
      
      const largePayload = {
        data: 'x'.repeat(100000), // 100KB string
        metadata: {
          size: 100000,
          type: 'large-test'
        }
      };
      
      triggerSocketEvent('large-payload-event', largePayload);
      
      expect(handler).toHaveBeenCalledWith(largePayload);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid connection/disconnection cycles', () => {
      const connectHandler = jest.fn();
      const disconnectHandler = jest.fn();
      
      socket.on('connect', connectHandler);
      socket.on('disconnect', disconnectHandler);
      
      // Rapid connect/disconnect cycles
      for (let i = 0; i < 10; i++) {
        socket.connect();
        socket.disconnect();
      }
      
      expect(connectHandler).toHaveBeenCalledTimes(10);
      expect(disconnectHandler).toHaveBeenCalledTimes(10);
    });
  });
});