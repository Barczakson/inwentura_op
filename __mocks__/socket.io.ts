/**
 * Socket.IO Server Mock for Testing
 * 
 * This mock provides a comprehensive Socket.IO server implementation for testing
 * server-side real-time functionality without requiring an actual server.
 */

interface MockServerSocket {
  id: string;
  on: jest.Mock;
  emit: jest.Mock;
  broadcast: {
    emit: jest.Mock;
  };
  join: jest.Mock;
  leave: jest.Mock;
  disconnect: jest.Mock;
}

interface MockServer {
  on: jest.Mock;
  emit: jest.Mock;
  close: jest.Mock;
  sockets: {
    emit: jest.Mock;
  };
}

// Global storage for server events and connected clients
const SERVER_EVENTS: Record<string, Function[]> = {};
const CONNECTED_SOCKETS: Map<string, MockServerSocket> = new Map();
let mockServerInstance: MockServer | null = null;

// Helper to trigger server events for testing
export const triggerServerEvent = (event: string, socket?: MockServerSocket, data?: any) => {
  if (SERVER_EVENTS[event]) {
    SERVER_EVENTS[event].forEach(callback => {
      if (event === 'connection' && socket) {
        callback(socket);
      } else {
        callback(data);
      }
    });
  }
};

// Helper to simulate client connection
export const simulateClientConnection = (socketId: string = 'test-socket-id'): MockServerSocket => {
  const socket: MockServerSocket = {
    id: socketId,
    
    on: jest.fn((event: string, callback: Function) => {
      // Store socket event listeners for this specific socket
      const socketEventKey = `${socketId}:${event}`;
      if (!SERVER_EVENTS[socketEventKey]) {
        SERVER_EVENTS[socketEventKey] = [];
      }
      SERVER_EVENTS[socketEventKey].push(callback);
      return socket;
    }),
    
    emit: jest.fn((event: string, data: any) => {
      // In real implementation, this would send to the client
      return socket;
    }),
    
    broadcast: {
      emit: jest.fn((event: string, data: any) => {
        // In real implementation, this would send to all other clients
        return socket;
      })
    },
    
    join: jest.fn((room: string) => {
      return socket;
    }),
    
    leave: jest.fn((room: string) => {
      return socket;
    }),
    
    disconnect: jest.fn((close?: boolean) => {
      CONNECTED_SOCKETS.delete(socketId);
      triggerServerEvent('disconnect', socket);
      return socket;
    })
  };
  
  CONNECTED_SOCKETS.set(socketId, socket);
  return socket;
};

// Helper to simulate client message to server
export const simulateClientMessage = (socketId: string, event: string, data: any) => {
  const socketEventKey = `${socketId}:${event}`;
  if (SERVER_EVENTS[socketEventKey]) {
    SERVER_EVENTS[socketEventKey].forEach(callback => callback(data));
  }
};

// Helper to get connected socket by ID
export const getConnectedSocket = (socketId: string): MockServerSocket | undefined => {
  return CONNECTED_SOCKETS.get(socketId);
};

// Helper to clear all server state
export const clearServerState = () => {
  Object.keys(SERVER_EVENTS).forEach(key => delete SERVER_EVENTS[key]);
  CONNECTED_SOCKETS.clear();
  if (mockServerInstance) {
    mockServerInstance.on.mockClear();
    mockServerInstance.emit.mockClear();
    mockServerInstance.close.mockClear();
    mockServerInstance.sockets.emit.mockClear();
  }
};

// Mock Server class
export class Server {
  constructor(httpServer?: any, options?: any) {
    mockServerInstance = {
      on: jest.fn((event: string, callback: Function) => {
        if (!SERVER_EVENTS[event]) {
          SERVER_EVENTS[event] = [];
        }
        SERVER_EVENTS[event].push(callback);
        return this;
      }),
      
      emit: jest.fn((event: string, data: any) => {
        // Emit to all connected sockets
        CONNECTED_SOCKETS.forEach(socket => {
          socket.emit(event, data);
        });
        return this;
      }),
      
      close: jest.fn(() => {
        // Close all connections
        CONNECTED_SOCKETS.clear();
        return this;
      }),
      
      sockets: {
        emit: jest.fn((event: string, data: any) => {
          // Emit to all connected sockets
          CONNECTED_SOCKETS.forEach(socket => {
            socket.emit(event, data);
          });
          return this;
        })
      }
    };
    
    return mockServerInstance;
  }
}

// Additional testing utilities
export const socketServerTestUtils = {
  // Get server instance for testing
  getServerInstance: () => mockServerInstance,
  
  // Simulate client connection with automatic event triggering
  connectClient: (socketId: string = 'test-socket-id') => {
    const socket = simulateClientConnection(socketId);
    // Trigger connection event
    setTimeout(() => triggerServerEvent('connection', socket), 0);
    return socket;
  },
  
  // Simulate multiple client connections
  connectMultipleClients: (count: number) => {
    const sockets: MockServerSocket[] = [];
    for (let i = 0; i < count; i++) {
      const socket = socketServerTestUtils.connectClient(`test-socket-${i}`);
      sockets.push(socket);
    }
    return sockets;
  },
  
  // Get all connected sockets
  getAllConnectedSockets: () => Array.from(CONNECTED_SOCKETS.values()),
  
  // Get server event listeners
  getServerEventListeners: (event: string) => SERVER_EVENTS[event] || [],
  
  // Check if server has event listeners
  hasServerEventListeners: (event: string) => Boolean(SERVER_EVENTS[event]?.length)
};