/**
 * Socket.IO Client Mock for Testing
 * 
 * This mock provides a comprehensive Socket.IO client implementation for testing
 * real-time functionality without requiring an actual WebSocket connection.
 */

interface MockSocket {
  id: string;
  connected: boolean;
  disconnected: boolean;
  on: jest.Mock;
  off: jest.Mock;
  emit: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  removeAllListeners: jest.Mock;
}

interface MockIo {
  connect: jest.Mock;
}

// Global event storage for testing event handling
const EVENTS: Record<string, Function[]> = {};
let mockSocketInstance: MockSocket | null = null;

// Helper to trigger events for testing
export const triggerSocketEvent = (event: string, data?: any) => {
  if (EVENTS[event]) {
    EVENTS[event].forEach(callback => callback(data));
  }
};

// Helper to clear all events (useful for test cleanup)
export const clearSocketEvents = () => {
  Object.keys(EVENTS).forEach(key => delete EVENTS[key]);
  if (mockSocketInstance) {
    mockSocketInstance.on.mockClear();
    mockSocketInstance.off.mockClear();
    mockSocketInstance.emit.mockClear();
    mockSocketInstance.connect.mockClear();
    mockSocketInstance.disconnect.mockClear();
  }
};

// Helper to get current socket instance for testing
export const getMockSocketInstance = () => mockSocketInstance;

// Mock socket implementation
const createMockSocket = (): MockSocket => {
  const socket: MockSocket = {
    id: 'mock-socket-id',
    connected: false,
    disconnected: true,
    
    on: jest.fn((event: string, callback: Function) => {
      if (!EVENTS[event]) {
        EVENTS[event] = [];
      }
      EVENTS[event].push(callback);
      return socket;
    }),
    
    off: jest.fn((event: string, callback?: Function) => {
      if (callback && EVENTS[event]) {
        const index = EVENTS[event].indexOf(callback);
        if (index > -1) {
          EVENTS[event].splice(index, 1);
        }
      } else if (EVENTS[event]) {
        delete EVENTS[event];
      }
      return socket;
    }),
    
    emit: jest.fn((event: string, data?: any, acknowledgment?: Function) => {
      // Simulate immediate acknowledgment for testing
      if (acknowledgment && typeof acknowledgment === 'function') {
        setTimeout(() => acknowledgment({ success: true }), 0);
      }
      
      // Auto-emit connection events for realistic testing
      if (event === 'connect') {
        socket.connected = true;
        socket.disconnected = false;
        triggerSocketEvent('connect');
      } else if (event === 'disconnect') {
        socket.connected = false;
        socket.disconnected = true;
        triggerSocketEvent('disconnect');
      }
      
      return socket;
    }),
    
    connect: jest.fn(() => {
      socket.connected = true;
      socket.disconnected = false;
      // Simulate async connection
      setTimeout(() => triggerSocketEvent('connect'), 0);
      return socket;
    }),
    
    disconnect: jest.fn(() => {
      socket.connected = false;
      socket.disconnected = true;
      // Simulate async disconnection
      setTimeout(() => triggerSocketEvent('disconnect'), 0);
      return socket;
    }),
    
    removeAllListeners: jest.fn((event?: string) => {
      if (event && EVENTS[event]) {
        delete EVENTS[event];
      } else {
        Object.keys(EVENTS).forEach(key => delete EVENTS[key]);
      }
      return socket;
    })
  };
  
  return socket;
};

// Mock IO implementation
export const io: MockIo = {
  connect: jest.fn((url: string, options?: any) => {
    mockSocketInstance = createMockSocket();
    
    // Simulate initial connection events
    setTimeout(() => {
      if (mockSocketInstance) {
        mockSocketInstance.connected = true;
        mockSocketInstance.disconnected = false;
        triggerSocketEvent('connect');
        
        // Simulate welcome message like the real server
        triggerSocketEvent('message', {
          text: 'Welcome to WebSocket Echo Server!',
          senderId: 'system',
          timestamp: new Date().toISOString(),
        });
      }
    }, 0);
    
    return mockSocketInstance;
  })
};

// Default export for CommonJS compatibility
export default { io };

// Additional testing utilities
export const socketTestUtils = {
  // Simulate server message
  sendServerMessage: (message: { text: string; senderId: string; timestamp?: string }) => {
    triggerSocketEvent('message', {
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    });
  },
  
  // Simulate connection error
  simulateConnectionError: (error: Error) => {
    triggerSocketEvent('connect_error', error);
  },
  
  // Simulate reconnection
  simulateReconnection: () => {
    triggerSocketEvent('reconnect');
  },
  
  // Get event listeners for testing
  getEventListeners: (event: string) => EVENTS[event] || [],
  
  // Check if event has listeners
  hasEventListeners: (event: string) => Boolean(EVENTS[event]?.length)
};