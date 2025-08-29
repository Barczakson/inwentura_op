/**
 * Socket.IO Test Utilities and Helpers
 * 
 * Comprehensive utilities for testing Socket.IO functionality including:
 * - Mock server and client setup
 * - Event simulation and verification
 * - Real-time data flow testing
 * - Performance and load testing helpers
 * - Integration with React components
 */

import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import { AddressInfo } from 'net';

export interface MockSocketEvent {
  event: string;
  data: any;
  timestamp: Date;
  socketId: string;
}

export interface SocketTestConfig {
  timeout?: number;
  maxConnections?: number;
  enableLogging?: boolean;
  autoCleanup?: boolean;
}

export class SocketTestServer {
  private httpServer: any;
  private io: SocketIOServer;
  private port: number = 0;
  private events: MockSocketEvent[] = [];
  private connectedSockets: Map<string, any> = new Map();
  private config: SocketTestConfig;

  constructor(config: SocketTestConfig = {}) {
    this.config = {
      timeout: 5000,
      maxConnections: 100,
      enableLogging: false,
      autoCleanup: true,
      ...config
    };
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer();
      this.io = new SocketIOServer(this.httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling']
      });

      this.setupEventHandlers();

      this.httpServer.listen(() => {
        this.port = (this.httpServer.address() as AddressInfo).port;
        if (this.config.enableLogging) {
          console.log(`Test Socket.IO server started on port ${this.port}`);
        }
        resolve(this.port);
      });

      this.httpServer.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      this.connectedSockets.set(socket.id, socket);
      
      if (this.config.enableLogging) {
        console.log(`Test client connected: ${socket.id}`);
      }

      // Record connection event
      this.events.push({
        event: 'connection',
        data: { socketId: socket.id },
        timestamp: new Date(),
        socketId: socket.id
      });

      // Setup default message handler (echo functionality)
      socket.on('message', (data) => {
        this.events.push({
          event: 'message',
          data,
          timestamp: new Date(),
          socketId: socket.id
        });

        // Echo the message back
        socket.emit('message', {
          text: `Echo: ${data.text}`,
          senderId: 'system',
          timestamp: new Date().toISOString(),
          originalMessage: data
        });
      });

      // Handle upload progress events
      socket.on('upload-progress', (data) => {
        this.events.push({
          event: 'upload-progress',
          data,
          timestamp: new Date(),
          socketId: socket.id
        });

        // Broadcast to all clients except sender
        socket.broadcast.emit('upload-progress', data);
      });

      // Handle data synchronization events
      socket.on('data-sync', (data) => {
        this.events.push({
          event: 'data-sync',
          data,
          timestamp: new Date(),
          socketId: socket.id
        });

        // Broadcast to all clients
        this.io.emit('data-sync', data);
      });

      // Handle custom events
      socket.on('custom-event', (data) => {
        this.events.push({
          event: 'custom-event',
          data,
          timestamp: new Date(),
          socketId: socket.id
        });

        socket.emit('custom-response', { ...data, processed: true });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.connectedSockets.delete(socket.id);
        
        this.events.push({
          event: 'disconnect',
          data: { reason },
          timestamp: new Date(),
          socketId: socket.id
        });

        if (this.config.enableLogging) {
          console.log(`Test client disconnected: ${socket.id}, reason: ${reason}`);
        }
      });

      // Send welcome message
      socket.emit('message', {
        text: 'Welcome to Test WebSocket Server!',
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.io) {
        this.io.close(() => {
          if (this.httpServer) {
            this.httpServer.close(() => {
              if (this.config.enableLogging) {
                console.log('Test Socket.IO server stopped');
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }

  getEvents(): MockSocketEvent[] {
    return [...this.events];
  }

  getEventsByType(eventType: string): MockSocketEvent[] {
    return this.events.filter(event => event.event === eventType);
  }

  getConnectedSocketIds(): string[] {
    return Array.from(this.connectedSockets.keys());
  }

  getConnectedSocketCount(): number {
    return this.connectedSockets.size;
  }

  clearEvents(): void {
    this.events = [];
  }

  // Emit event to all connected clients
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
    this.events.push({
      event: `broadcast:${event}`,
      data,
      timestamp: new Date(),
      socketId: 'server'
    });
  }

  // Emit event to specific socket
  emitToSocket(socketId: string, event: string, data: any): boolean {
    const socket = this.connectedSockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
      this.events.push({
        event: `emit:${event}`,
        data,
        timestamp: new Date(),
        socketId
      });
      return true;
    }
    return false;
  }

  // Wait for specific event to occur
  async waitForEvent(eventType: string, timeout: number = 5000): Promise<MockSocketEvent> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkForEvent = () => {
        const event = this.events.find(e => e.event === eventType && e.timestamp.getTime() >= startTime);
        if (event) {
          resolve(event);
        } else if (Date.now() - startTime >= timeout) {
          reject(new Error(`Event '${eventType}' not received within ${timeout}ms`));
        } else {
          setTimeout(checkForEvent, 10);
        }
      };
      
      checkForEvent();
    });
  }

  // Get performance statistics
  getPerformanceStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    averageEventsPerSecond: number;
    peakConnections: number;
    currentConnections: number;
  } {
    const eventsByType: Record<string, number> = {};
    this.events.forEach(event => {
      eventsByType[event.event] = (eventsByType[event.event] || 0) + 1;
    });

    const timeSpan = this.events.length > 1 
      ? (this.events[this.events.length - 1].timestamp.getTime() - this.events[0].timestamp.getTime()) / 1000
      : 1;

    return {
      totalEvents: this.events.length,
      eventsByType,
      averageEventsPerSecond: this.events.length / timeSpan,
      peakConnections: this.events.filter(e => e.event === 'connection').length,
      currentConnections: this.connectedSockets.size
    };
  }
}

export class SocketTestClient {
  private client: any;
  private events: MockSocketEvent[] = [];
  private connected: boolean = false;
  private config: SocketTestConfig;

  constructor(config: SocketTestConfig = {}) {
    this.config = {
      timeout: 5000,
      enableLogging: false,
      autoCleanup: true,
      ...config
    };
  }

  async connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = SocketIOClient(`http://localhost:${port}`, {
        transports: ['websocket', 'polling'],
        timeout: this.config.timeout
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.events.push({
          event: 'connect',
          data: { socketId: this.client.id },
          timestamp: new Date(),
          socketId: this.client.id
        });

        if (this.config.enableLogging) {
          console.log(`Test client connected: ${this.client.id}`);
        }

        resolve();
      });

      this.client.on('disconnect', () => {
        this.connected = false;
        this.events.push({
          event: 'disconnect',
          data: {},
          timestamp: new Date(),
          socketId: this.client.id
        });

        if (this.config.enableLogging) {
          console.log(`Test client disconnected: ${this.client.id}`);
        }
      });

      this.client.on('connect_error', (error: Error) => {
        reject(error);
      });

      // Set up event listeners for common events
      ['message', 'upload-progress', 'data-sync', 'custom-response'].forEach(eventType => {
        this.client.on(eventType, (data: any) => {
          this.events.push({
            event: eventType,
            data,
            timestamp: new Date(),
            socketId: this.client.id
          });
        });
      });

      // Timeout handling
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, this.config.timeout);
    });
  }

  emit(event: string, data: any): void {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    this.client.emit(event, data);
    this.events.push({
      event: `emit:${event}`,
      data,
      timestamp: new Date(),
      socketId: this.client.id
    });
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      this.client.disconnect();
      this.connected = false;
    }
  }

  getEvents(): MockSocketEvent[] {
    return [...this.events];
  }

  getEventsByType(eventType: string): MockSocketEvent[] {
    return this.events.filter(event => event.event === eventType);
  }

  clearEvents(): void {
    this.events = [];
  }

  isConnected(): boolean {
    return this.connected;
  }

  getId(): string {
    return this.client ? this.client.id : '';
  }

  // Wait for specific event
  async waitForEvent(eventType: string, timeout: number = 5000): Promise<MockSocketEvent> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkForEvent = () => {
        const event = this.events.find(e => e.event === eventType && e.timestamp.getTime() >= startTime);
        if (event) {
          resolve(event);
        } else if (Date.now() - startTime >= timeout) {
          reject(new Error(`Event '${eventType}' not received within ${timeout}ms`));
        } else {
          setTimeout(checkForEvent, 10);
        }
      };
      
      checkForEvent();
    });
  }
}

// Utility functions for common test scenarios
export class SocketTestScenarios {
  static async simpleEchoTest(server: SocketTestServer, client: SocketTestClient): Promise<boolean> {
    const testMessage = {
      text: 'Test echo message',
      senderId: 'test-client',
      timestamp: new Date().toISOString()
    };

    client.emit('message', testMessage);

    try {
      const response = await client.waitForEvent('message', 2000);
      return response.data.text.includes('Echo:') && response.data.text.includes(testMessage.text);
    } catch (error) {
      return false;
    }
  }

  static async uploadProgressTest(server: SocketTestServer, clients: SocketTestClient[]): Promise<boolean> {
    if (clients.length < 2) return false;

    const progressData = {
      uploadId: 'test-upload-123',
      progress: 50,
      fileName: 'test-file.xlsx',
      status: 'processing'
    };

    // One client emits upload progress
    clients[0].emit('upload-progress', progressData);

    // Other clients should receive the broadcast
    try {
      for (let i = 1; i < clients.length; i++) {
        await clients[i].waitForEvent('upload-progress', 2000);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  static async dataSyncTest(server: SocketTestServer, clients: SocketTestClient[]): Promise<boolean> {
    const syncData = {
      type: 'DATA_UPDATE',
      table: 'excel_files',
      operation: 'INSERT',
      data: { id: 'test-id', fileName: 'test.xlsx' }
    };

    // One client emits data sync
    clients[0].emit('data-sync', syncData);

    // All clients (including sender) should receive the broadcast
    try {
      for (const client of clients) {
        await client.waitForEvent('data-sync', 2000);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  static async loadTest(server: SocketTestServer, clientCount: number = 10, messagesPerClient: number = 100): Promise<{
    success: boolean;
    stats: {
      clientsConnected: number;
      totalMessagesSent: number;
      totalMessagesReceived: number;
      averageResponseTime: number;
      errors: number;
    };
  }> {
    const clients: SocketTestClient[] = [];
    const stats = {
      clientsConnected: 0,
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      averageResponseTime: 0,
      errors: 0
    };

    try {
      // Connect clients
      for (let i = 0; i < clientCount; i++) {
        const client = new SocketTestClient();
        await client.connect(server.getPort());
        clients.push(client);
        stats.clientsConnected++;
      }

      const responseTimes: number[] = [];

      // Send messages from each client
      for (const client of clients) {
        for (let i = 0; i < messagesPerClient; i++) {
          const startTime = Date.now();
          
          client.emit('message', {
            text: `Load test message ${i}`,
            senderId: client.getId(),
            timestamp: new Date().toISOString()
          });
          
          stats.totalMessagesSent++;

          try {
            await client.waitForEvent('message', 5000);
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            stats.totalMessagesReceived++;
          } catch (error) {
            stats.errors++;
          }
        }
      }

      // Calculate average response time
      stats.averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0;

      // Cleanup
      await Promise.all(clients.map(client => client.disconnect()));

      return {
        success: stats.errors === 0 && stats.totalMessagesReceived === stats.totalMessagesSent,
        stats
      };

    } catch (error) {
      // Cleanup on error
      await Promise.all(clients.map(client => client.disconnect().catch(() => {})));
      
      return {
        success: false,
        stats: { ...stats, errors: stats.errors + 1 }
      };
    }
  }
}

// React Testing Library integration helpers
export const createSocketTestProvider = (port: number) => {
  return ({ children }: { children: React.ReactNode }) => {
    // This would typically wrap children with a SocketContext provider
    // For now, it's a placeholder that could be extended based on your app structure
    return <div data-testid="socket-provider" data-port={port}>{children}</div>;
  };
};

// Jest matcher extensions for Socket.IO testing
export const socketMatchers = {
  toHaveReceivedEvent: (client: SocketTestClient, eventType: string) => {
    const events = client.getEventsByType(eventType);
    return {
      pass: events.length > 0,
      message: () => `Expected client to have received event '${eventType}', but it ${events.length > 0 ? 'did' : 'did not'}`
    };
  },

  toHaveEmittedEvent: (client: SocketTestClient, eventType: string) => {
    const events = client.getEventsByType(`emit:${eventType}`);
    return {
      pass: events.length > 0,
      message: () => `Expected client to have emitted event '${eventType}', but it ${events.length > 0 ? 'did' : 'did not'}`
    };
  },

  toHaveConnectedClients: (server: SocketTestServer, expectedCount: number) => {
    const actualCount = server.getConnectedSocketCount();
    return {
      pass: actualCount === expectedCount,
      message: () => `Expected server to have ${expectedCount} connected clients, but it has ${actualCount}`
    };
  }
};

// Export helper for test setup and teardown
export class SocketTestManager {
  private server: SocketTestServer | null = null;
  private clients: SocketTestClient[] = [];

  async setup(config: SocketTestConfig = {}): Promise<{ server: SocketTestServer; port: number }> {
    this.server = new SocketTestServer(config);
    const port = await this.server.start();
    return { server: this.server, port };
  }

  async createClient(port: number, config: SocketTestConfig = {}): Promise<SocketTestClient> {
    const client = new SocketTestClient(config);
    await client.connect(port);
    this.clients.push(client);
    return client;
  }

  async createMultipleClients(port: number, count: number, config: SocketTestConfig = {}): Promise<SocketTestClient[]> {
    const clients: SocketTestClient[] = [];
    for (let i = 0; i < count; i++) {
      const client = await this.createClient(port, config);
      clients.push(client);
    }
    return clients;
  }

  async teardown(): Promise<void> {
    // Disconnect all clients
    await Promise.all(this.clients.map(client => client.disconnect().catch(() => {})));
    this.clients = [];

    // Stop server
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
  }

  getServer(): SocketTestServer | null {
    return this.server;
  }

  getClients(): SocketTestClient[] {
    return [...this.clients];
  }
}

// Export everything
export {
  SocketTestServer,
  SocketTestClient,
  SocketTestScenarios,
  SocketTestManager
};