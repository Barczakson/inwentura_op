/**
 * Socket Test Helpers Integration Tests
 * 
 * Tests for the Socket.IO test utilities to ensure they work correctly
 * and can be used reliably in other test suites.
 */

import {
  SocketTestServer,
  SocketTestClient,
  SocketTestScenarios,
  SocketTestManager,
  socketMatchers
} from '../socket-test-helpers';

// Extend Jest matchers (in a real setup, this would be in setupTests.js)
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveReceivedEvent(eventType: string): R;
      toHaveEmittedEvent(eventType: string): R;
      toHaveConnectedClients(expectedCount: number): R;
    }
  }
}

// Add custom matchers to Jest
expect.extend(socketMatchers);

describe('Socket Test Helpers', () => {
  describe('SocketTestServer', () => {
    let server: SocketTestServer;

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should start and stop server successfully', async () => {
      server = new SocketTestServer();
      const port = await server.start();
      
      expect(port).toBeGreaterThan(0);
      expect(server.getPort()).toBe(port);
      expect(server.getConnectedSocketCount()).toBe(0);
      
      await server.stop();
    });

    it('should track connected clients', async () => {
      server = new SocketTestServer();
      const port = await server.start();
      
      const client1 = new SocketTestClient();
      const client2 = new SocketTestClient();
      
      await client1.connect(port);
      expect(server.getConnectedSocketCount()).toBe(1);
      
      await client2.connect(port);
      expect(server.getConnectedSocketCount()).toBe(2);
      
      await client1.disconnect();
      // Give a moment for disconnection to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(server.getConnectedSocketCount()).toBe(1);
      
      await client2.disconnect();
    });

    it('should record events correctly', async () => {
      server = new SocketTestServer({ enableLogging: false });
      const port = await server.start();
      
      const client = new SocketTestClient();
      await client.connect(port);
      
      // Send a message
      client.emit('message', { text: 'Test message', senderId: 'test' });
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const events = server.getEvents();
      const messageEvents = server.getEventsByType('message');
      
      expect(events.length).toBeGreaterThan(0);
      expect(messageEvents.length).toBe(1);
      expect(messageEvents[0].data.text).toBe('Test message');
      
      await client.disconnect();
    });

    it('should provide performance statistics', async () => {
      server = new SocketTestServer();
      const port = await server.start();
      
      const client = new SocketTestClient();
      await client.connect(port);
      
      // Generate some events
      for (let i = 0; i < 5; i++) {
        client.emit('message', { text: `Message ${i}`, senderId: 'test' });
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = server.getPerformanceStats();
      
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.eventsByType.connection).toBe(1);
      expect(stats.eventsByType.message).toBe(5);
      expect(stats.currentConnections).toBe(1);
      expect(stats.averageEventsPerSecond).toBeGreaterThan(0);
      
      await client.disconnect();
    });

    it('should broadcast messages correctly', async () => {
      server = new SocketTestServer();
      const port = await server.start();
      
      const client1 = new SocketTestClient();
      const client2 = new SocketTestClient();
      
      await client1.connect(port);
      await client2.connect(port);
      
      // Clear initial events
      client1.clearEvents();
      client2.clearEvents();
      
      server.broadcast('test-broadcast', { message: 'Hello everyone!' });
      
      // Wait for broadcast to be received
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const client1Events = client1.getEventsByType('test-broadcast');
      const client2Events = client2.getEventsByType('test-broadcast');
      
      expect(client1Events.length).toBe(1);
      expect(client2Events.length).toBe(1);
      expect(client1Events[0].data.message).toBe('Hello everyone!');
      
      await client1.disconnect();
      await client2.disconnect();
    });

    it('should wait for specific events', async () => {
      server = new SocketTestServer();
      const port = await server.start();
      
      const client = new SocketTestClient();
      await client.connect(port);
      
      // Set up async event emission
      setTimeout(() => {
        client.emit('custom-event', { test: 'data' });
      }, 100);
      
      // Wait for the event
      const event = await server.waitForEvent('custom-event', 2000);
      
      expect(event).toBeDefined();
      expect(event.data.test).toBe('data');
      expect(event.event).toBe('custom-event');
      
      await client.disconnect();
    });

    it('should timeout when waiting for non-existent events', async () => {
      server = new SocketTestServer();
      const port = await server.start();
      
      await expect(
        server.waitForEvent('non-existent-event', 100)
      ).rejects.toThrow('Event \'non-existent-event\' not received within 100ms');
    });
  });

  describe('SocketTestClient', () => {
    let server: SocketTestServer;
    let port: number;

    beforeEach(async () => {
      server = new SocketTestServer();
      port = await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should connect and disconnect properly', async () => {
      const client = new SocketTestClient();
      
      expect(client.isConnected()).toBe(false);
      
      await client.connect(port);
      expect(client.isConnected()).toBe(true);
      expect(client.getId()).toBeTruthy();
      
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should emit and receive events', async () => {
      const client = new SocketTestClient();
      await client.connect(port);
      
      // Clear connection events
      client.clearEvents();
      
      client.emit('message', { text: 'Test message', senderId: 'test' });
      
      // Wait for echo response
      const response = await client.waitForEvent('message', 2000);
      
      expect(response.data.text).toContain('Echo: Test message');
      expect(response.data.senderId).toBe('system');
      
      await client.disconnect();
    });

    it('should track emitted events', async () => {
      const client = new SocketTestClient();
      await client.connect(port);
      
      client.emit('custom-event', { test: 'data' });
      client.emit('another-event', { more: 'data' });
      
      const emittedEvents = client.getEvents();
      const customEvents = client.getEventsByType('emit:custom-event');
      
      expect(emittedEvents.length).toBeGreaterThan(0);
      expect(customEvents.length).toBe(1);
      expect(customEvents[0].data.test).toBe('data');
      
      await client.disconnect();
    });

    it('should handle connection errors gracefully', async () => {
      const client = new SocketTestClient({ timeout: 100 });
      
      // Try to connect to invalid port
      await expect(
        client.connect(99999)
      ).rejects.toThrow();
    });

    it('should throw error when emitting while disconnected', async () => {
      const client = new SocketTestClient();
      
      expect(() => {
        client.emit('test-event', { data: 'test' });
      }).toThrow('Client not connected');
    });
  });

  describe('SocketTestScenarios', () => {
    let server: SocketTestServer;
    let port: number;

    beforeEach(async () => {
      server = new SocketTestServer();
      port = await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should run simple echo test', async () => {
      const client = new SocketTestClient();
      await client.connect(port);
      
      const result = await SocketTestScenarios.simpleEchoTest(server, client);
      
      expect(result).toBe(true);
      
      await client.disconnect();
    });

    it('should run upload progress test', async () => {
      const clients = [
        new SocketTestClient(),
        new SocketTestClient(),
        new SocketTestClient()
      ];
      
      // Connect all clients
      await Promise.all(clients.map(client => client.connect(port)));
      
      const result = await SocketTestScenarios.uploadProgressTest(server, clients);
      
      expect(result).toBe(true);
      
      // Cleanup
      await Promise.all(clients.map(client => client.disconnect()));
    });

    it('should run data sync test', async () => {
      const clients = [
        new SocketTestClient(),
        new SocketTestClient()
      ];
      
      await Promise.all(clients.map(client => client.connect(port)));
      
      const result = await SocketTestScenarios.dataSyncTest(server, clients);
      
      expect(result).toBe(true);
      
      await Promise.all(clients.map(client => client.disconnect()));
    });

    it('should run load test', async () => {
      const result = await SocketTestScenarios.loadTest(server, 5, 10);
      
      expect(result.success).toBe(true);
      expect(result.stats.clientsConnected).toBe(5);
      expect(result.stats.totalMessagesSent).toBe(50); // 5 clients * 10 messages
      expect(result.stats.totalMessagesReceived).toBe(50);
      expect(result.stats.averageResponseTime).toBeGreaterThan(0);
      expect(result.stats.errors).toBe(0);
    });

    it('should handle load test with some failures', async () => {
      // Stop server to simulate failures
      await server.stop();
      
      const result = await SocketTestScenarios.loadTest(server, 2, 5);
      
      expect(result.success).toBe(false);
      expect(result.stats.errors).toBeGreaterThan(0);
    });
  });

  describe('Custom Jest Matchers', () => {
    let server: SocketTestServer;
    let port: number;

    beforeEach(async () => {
      server = new SocketTestServer();
      port = await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should use toHaveReceivedEvent matcher', async () => {
      const client = new SocketTestClient();
      await client.connect(port);
      
      // Should have received welcome message
      expect(client).toHaveReceivedEvent('message');
      
      await client.disconnect();
    });

    it('should use toHaveEmittedEvent matcher', async () => {
      const client = new SocketTestClient();
      await client.connect(port);
      
      client.emit('test-event', { data: 'test' });
      
      expect(client).toHaveEmittedEvent('test-event');
      
      await client.disconnect();
    });

    it('should use toHaveConnectedClients matcher', async () => {
      expect(server).toHaveConnectedClients(0);
      
      const client1 = new SocketTestClient();
      const client2 = new SocketTestClient();
      
      await client1.connect(port);
      expect(server).toHaveConnectedClients(1);
      
      await client2.connect(port);
      expect(server).toHaveConnectedClients(2);
      
      await client1.disconnect();
      await client2.disconnect();
    });
  });

  describe('SocketTestManager', () => {
    let manager: SocketTestManager;

    beforeEach(() => {
      manager = new SocketTestManager();
    });

    afterEach(async () => {
      await manager.teardown();
    });

    it('should manage server and clients lifecycle', async () => {
      const { server, port } = await manager.setup();
      
      expect(server).toBeDefined();
      expect(port).toBeGreaterThan(0);
      expect(manager.getServer()).toBe(server);
      
      const client1 = await manager.createClient(port);
      const client2 = await manager.createClient(port);
      
      expect(manager.getClients()).toHaveLength(2);
      expect(server.getConnectedSocketCount()).toBe(2);
      
      await manager.teardown();
      
      expect(manager.getServer()).toBeNull();
      expect(manager.getClients()).toHaveLength(0);
    });

    it('should create multiple clients at once', async () => {
      const { server, port } = await manager.setup();
      
      const clients = await manager.createMultipleClients(port, 5);
      
      expect(clients).toHaveLength(5);
      expect(manager.getClients()).toHaveLength(5);
      expect(server.getConnectedSocketCount()).toBe(5);
    });

    it('should handle setup and teardown multiple times', async () => {
      // First setup
      let { server, port } = await manager.setup();
      await manager.createClient(port);
      
      expect(server.getConnectedSocketCount()).toBe(1);
      
      await manager.teardown();
      
      // Second setup
      ({ server, port } = await manager.setup());
      await manager.createMultipleClients(port, 3);
      
      expect(server.getConnectedSocketCount()).toBe(3);
      
      await manager.teardown();
    });

    it('should handle errors in teardown gracefully', async () => {
      const { port } = await manager.setup();
      await manager.createClient(port);
      
      // Force disconnect one client manually to test error handling
      const clients = manager.getClients();
      await clients[0].disconnect();
      
      // Teardown should still work
      await expect(manager.teardown()).resolves.not.toThrow();
    });
  });

  describe('Real-world Integration Scenarios', () => {
    let manager: SocketTestManager;

    beforeEach(() => {
      manager = new SocketTestManager();
    });

    afterEach(async () => {
      await manager.teardown();
    });

    it('should simulate complete Excel upload workflow', async () => {
      const { server, port } = await manager.setup();
      const clients = await manager.createMultipleClients(port, 3);
      
      // Simulate file upload progress updates
      const uploadEvents = [
        { progress: 0, phase: 'starting', fileName: 'test.xlsx' },
        { progress: 25, phase: 'parsing', fileName: 'test.xlsx' },
        { progress: 50, phase: 'processing', fileName: 'test.xlsx' },
        { progress: 75, phase: 'saving', fileName: 'test.xlsx' },
        { progress: 100, phase: 'complete', fileName: 'test.xlsx' }
      ];
      
      // Clear initial events
      clients.forEach(client => client.clearEvents());
      
      // Emit upload progress from first client
      for (const event of uploadEvents) {
        clients[0].emit('upload-progress', event);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Verify other clients received all updates
      for (let i = 1; i < clients.length; i++) {
        const receivedEvents = clients[i].getEventsByType('upload-progress');
        expect(receivedEvents).toHaveLength(uploadEvents.length);
        expect(receivedEvents[4].data.phase).toBe('complete');
      }
    });

    it('should simulate real-time data synchronization', async () => {
      const { server, port } = await manager.setup();
      const clients = await manager.createMultipleClients(port, 4);
      
      const syncEvents = [
        {
          type: 'EXCEL_FILE_CREATED',
          table: 'excel_files',
          data: { id: 'file-1', fileName: 'data.xlsx' }
        },
        {
          type: 'EXCEL_ROWS_INSERTED',
          table: 'excel_rows',
          data: { fileId: 'file-1', count: 150 }
        },
        {
          type: 'AGGREGATION_UPDATED',
          table: 'aggregated_items',
          data: { items: 25, totalQuantity: 5000 }
        }
      ];
      
      // Clear initial events
      clients.forEach(client => client.clearEvents());
      
      // Emit data sync events from one client
      for (const event of syncEvents) {
        clients[0].emit('data-sync', event);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // All clients should receive all sync events
      for (const client of clients) {
        const syncEvents = client.getEventsByType('data-sync');
        expect(syncEvents).toHaveLength(3);
      }
    });

    it('should handle high concurrency scenarios', async () => {
      const { server, port } = await manager.setup();
      const clientCount = 20;
      const messagesPerClient = 50;
      
      const clients = await manager.createMultipleClients(port, clientCount);
      
      // Clear initial events
      clients.forEach(client => client.clearEvents());
      
      const startTime = Date.now();
      
      // Send messages concurrently from all clients
      const messagePromises = clients.flatMap((client, clientIndex) =>
        Array.from({ length: messagesPerClient }, (_, msgIndex) =>
          new Promise<void>(resolve => {
            setTimeout(() => {
              client.emit('message', {
                text: `Message ${msgIndex} from client ${clientIndex}`,
                senderId: `client-${clientIndex}`,
                timestamp: new Date().toISOString()
              });
              resolve();
            }, Math.random() * 100); // Random delay up to 100ms
          })
        )
      );
      
      await Promise.all(messagePromises);
      
      // Wait for all responses
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify performance
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // Check that most messages were echoed back
      const totalExpectedMessages = clientCount * messagesPerClient;
      let totalReceivedMessages = 0;
      
      clients.forEach(client => {
        const messageEvents = client.getEventsByType('message');
        totalReceivedMessages += messageEvents.length;
      });
      
      // Allow for some message loss under high load, but expect >90% success rate
      expect(totalReceivedMessages).toBeGreaterThan(totalExpectedMessages * 0.9);
      
      // Check server stats
      const stats = server.getPerformanceStats();
      expect(stats.totalEvents).toBeGreaterThan(totalExpectedMessages);
      expect(stats.averageEventsPerSecond).toBeGreaterThan(100); // Should handle >100 events/second
    });
  });
});