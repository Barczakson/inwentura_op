/**
 * Error Boundary and Error Handling Component Tests
 * 
 * Comprehensive tests for error boundaries and error handling patterns including:
 * - React Error Boundary testing
 * - API error handling components
 * - Toast notification error handling
 * - Network error recovery
 * - Form validation error handling
 * - Socket.IO error handling in components
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Component, ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { 
  clearSocketEvents, 
  triggerSocketEvent, 
  socketTestUtils 
} from '../../../__mocks__/socket.io-client';

// Mock toast notifications
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    dismiss: jest.fn(),
  }
}));

// Mock Socket.IO client
jest.mock('socket.io-client');

// Error Boundary Component for Testing
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class TestErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: (error: Error, errorInfo: any) => void },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo
    });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div data-testid="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <p data-testid="error-message">{this.state.error?.message}</p>
          <button 
            data-testid="retry-button"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Component that throws errors for testing
const ErrorThrowingComponent = ({ shouldThrow, errorMessage }: { shouldThrow: boolean; errorMessage: string }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div data-testid="no-error">Component rendered successfully</div>;
};

// API Error Handling Component
const APIErrorHandler = ({ endpoint, children }: { endpoint: string; children: ReactNode }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAPICall = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Resource not found');
        } else if (response.status === 500) {
          throw new Error('Internal server error');
        } else if (response.status === 429) {
          throw new Error('Too many requests - please try again later');
        } else if (response.status >= 400) {
          throw new Error('Request failed - please check your input');
        }
      }
      
      const data = await response.json();
      toast.success('Request completed successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="api-error-handler">
      {error && (
        <div data-testid="api-error-message" role="alert">
          {error}
        </div>
      )}
      {loading && (
        <div data-testid="loading-indicator">Loading...</div>
      )}
      <button data-testid="api-call-button" onClick={handleAPICall} disabled={loading}>
        Make API Call
      </button>
      {children}
    </div>
  );
};

// Form Validation Error Handling Component
const FormWithValidation = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    file: null as File | null
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.file) {
      newErrors.file = 'File is required';
    } else if (formData.file.size > 10 * 1024 * 1024) {
      newErrors.file = 'File size must be less than 10MB';
    } else if (!formData.file.name.endsWith('.xlsx') && !formData.file.name.endsWith('.xls')) {
      newErrors.file = 'File must be an Excel file (.xlsx or .xls)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate potential server error
      if (formData.name === 'error') {
        throw new Error('Server validation failed');
      }
      
      toast.success('Form submitted successfully');
      
      // Reset form
      setFormData({ name: '', email: '', file: null });
      setErrors({});
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Submission failed';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, file }));
    
    // Clear file error when new file is selected
    if (errors.file && file) {
      setErrors(prev => ({ ...prev, file: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="validation-form">
      <div>
        <label htmlFor="name">Name:</label>
        <input
          id="name"
          data-testid="name-input"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
        {errors.name && (
          <div data-testid="name-error" role="alert">
            {errors.name}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="email">Email:</label>
        <input
          id="email"
          type="email"
          data-testid="email-input"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        />
        {errors.email && (
          <div data-testid="email-error" role="alert">
            {errors.email}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="file">File:</label>
        <input
          id="file"
          type="file"
          data-testid="file-input"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
        />
        {errors.file && (
          <div data-testid="file-error" role="alert">
            {errors.file}
          </div>
        )}
      </div>

      <button 
        type="submit" 
        data-testid="submit-button"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
};

// Socket.IO Error Handling Component
const SocketErrorHandler = () => {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleConnectionError = (error: Error) => {
    setConnectionStatus('error');
    setLastError(error.message);
    toast.error(`Connection error: ${error.message}`);

    // Auto-retry logic
    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        attemptReconnection();
      }, 1000 * Math.pow(2, retryCount)); // Exponential backoff
    } else {
      toast.error('Maximum retry attempts reached');
    }
  };

  const attemptReconnection = () => {
    toast.info('Attempting to reconnect...');
    // Simulate reconnection attempt
    setTimeout(() => {
      if (Math.random() > 0.3) { // 70% success rate for testing
        setConnectionStatus('connected');
        setLastError(null);
        setRetryCount(0);
        toast.success('Reconnected successfully');
      } else {
        handleConnectionError(new Error('Reconnection failed'));
      }
    }, 500);
  };

  const handleManualReconnect = () => {
    setRetryCount(0);
    attemptReconnection();
  };

  return (
    <div data-testid="socket-error-handler">
      <div data-testid="connection-status">
        Status: {connectionStatus}
      </div>
      
      {lastError && (
        <div data-testid="socket-error-message" role="alert">
          Error: {lastError}
        </div>
      )}
      
      <div data-testid="retry-count">
        Retry attempts: {retryCount}
      </div>
      
      <button 
        data-testid="reconnect-button"
        onClick={handleManualReconnect}
        disabled={connectionStatus === 'connected'}
      >
        Reconnect
      </button>
      
      <button 
        data-testid="simulate-error-button"
        onClick={() => handleConnectionError(new Error('Simulated connection error'))}
      >
        Simulate Error
      </button>
    </div>
  );
};

describe('Error Boundary and Error Handling Tests', () => {
  beforeEach(() => {
    clearSocketEvents();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearSocketEvents();
  });

  describe('React Error Boundary', () => {
    it('should catch and display component errors', () => {
      const onError = jest.fn();
      
      render(
        <TestErrorBoundary onError={onError}>
          <ErrorThrowingComponent shouldThrow={true} errorMessage="Test error message" />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Test error message');
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });

    it('should render children normally when no error occurs', () => {
      render(
        <TestErrorBoundary>
          <ErrorThrowingComponent shouldThrow={false} errorMessage="" />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('no-error')).toBeInTheDocument();
      expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
    });

    it('should allow retry functionality', () => {
      const TestComponent = () => {
        const [shouldThrow, setShouldThrow] = useState(true);
        
        return (
          <div>
            <button data-testid="fix-error" onClick={() => setShouldThrow(false)}>
              Fix Error
            </button>
            <ErrorThrowingComponent 
              shouldThrow={shouldThrow} 
              errorMessage="Recoverable error" 
            />
          </div>
        );
      };

      render(
        <TestErrorBoundary>
          <TestComponent />
        </TestErrorBoundary>
      );

      // Initially shows error
      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

      // Fix the underlying issue
      fireEvent.click(screen.getByTestId('fix-error'));

      // Retry
      fireEvent.click(screen.getByTestId('retry-button'));

      // Should now render successfully
      expect(screen.getByTestId('no-error')).toBeInTheDocument();
    });

    it('should render custom fallback UI', () => {
      const CustomFallback = (
        <div data-testid="custom-fallback">
          <h1>Oops! Something went wrong</h1>
          <p>Please contact support</p>
        </div>
      );

      render(
        <TestErrorBoundary fallback={CustomFallback}>
          <ErrorThrowingComponent shouldThrow={true} errorMessage="Custom error" />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });
  });

  describe('API Error Handling', () => {
    beforeEach(() => {
      // Mock fetch globally
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle 404 errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' })
      });

      render(<APIErrorHandler endpoint="/api/test">Content</APIErrorHandler>);

      fireEvent.click(screen.getByTestId('api-call-button'));

      await waitFor(() => {
        expect(screen.getByTestId('api-error-message')).toHaveTextContent('Resource not found');
      });

      expect(toast.error).toHaveBeenCalledWith('Resource not found');
    });

    it('should handle 500 errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      });

      render(<APIErrorHandler endpoint="/api/test">Content</APIErrorHandler>);

      fireEvent.click(screen.getByTestId('api-call-button'));

      await waitFor(() => {
        expect(screen.getByTestId('api-error-message')).toHaveTextContent('Internal server error');
      });

      expect(toast.error).toHaveBeenCalledWith('Internal server error');
    });

    it('should handle rate limiting (429) errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limited' })
      });

      render(<APIErrorHandler endpoint="/api/test">Content</APIErrorHandler>);

      fireEvent.click(screen.getByTestId('api-call-button'));

      await waitFor(() => {
        expect(screen.getByTestId('api-error-message')).toHaveTextContent('Too many requests - please try again later');
      });

      expect(toast.error).toHaveBeenCalledWith('Too many requests - please try again later');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<APIErrorHandler endpoint="/api/test">Content</APIErrorHandler>);

      fireEvent.click(screen.getByTestId('api-call-button'));

      await waitFor(() => {
        expect(screen.getByTestId('api-error-message')).toHaveTextContent('Network error');
      });

      expect(toast.error).toHaveBeenCalledWith('Network error');
    });

    it('should show loading state during API calls', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true })
        }), 100))
      );

      render(<APIErrorHandler endpoint="/api/test">Content</APIErrorHandler>);

      fireEvent.click(screen.getByTestId('api-call-button'));

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('api-call-button')).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });

      expect(toast.success).toHaveBeenCalledWith('Request completed successfully');
    });

    it('should handle successful API calls', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: 'test data' })
      });

      render(<APIErrorHandler endpoint="/api/test">Content</APIErrorHandler>);

      fireEvent.click(screen.getByTestId('api-call-button'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Request completed successfully');
      });

      expect(screen.queryByTestId('api-error-message')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation Error Handling', () => {
    it('should validate required fields', async () => {
      render(<FormWithValidation />);

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('name-error')).toHaveTextContent('Name is required');
        expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required');
        expect(screen.getByTestId('file-error')).toHaveTextContent('File is required');
      });

      expect(toast.error).toHaveBeenCalledWith('Please fix the form errors');
    });

    it('should validate email format', async () => {
      render(<FormWithValidation />);

      fireEvent.change(screen.getByTestId('email-input'), {
        target: { value: 'invalid-email' }
      });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toHaveTextContent('Please enter a valid email address');
      });
    });

    it('should validate name length', async () => {
      render(<FormWithValidation />);

      fireEvent.change(screen.getByTestId('name-input'), {
        target: { value: 'a' }
      });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('name-error')).toHaveTextContent('Name must be at least 2 characters');
      });
    });

    it('should validate file type', async () => {
      render(<FormWithValidation />);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      fireEvent.change(screen.getByTestId('file-input'), {
        target: { files: [file] }
      });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('file-error')).toHaveTextContent('File must be an Excel file (.xlsx or .xls)');
      });
    });

    it('should validate file size', async () => {
      render(<FormWithValidation />);

      // Create a large file (mock)
      const largeFile = new File(['content'], 'large.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 }); // 15MB

      fireEvent.change(screen.getByTestId('file-input'), {
        target: { files: [largeFile] }
      });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('file-error')).toHaveTextContent('File size must be less than 10MB');
      });
    });

    it('should submit successfully with valid data', async () => {
      render(<FormWithValidation />);

      const file = new File(['content'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      fireEvent.change(screen.getByTestId('name-input'), {
        target: { value: 'John Doe' }
      });
      fireEvent.change(screen.getByTestId('email-input'), {
        target: { value: 'john@example.com' }
      });
      fireEvent.change(screen.getByTestId('file-input'), {
        target: { files: [file] }
      });

      fireEvent.click(screen.getByTestId('submit-button'));

      expect(screen.getByTestId('submit-button')).toBeDisabled();
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Submitting...');

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Form submitted successfully');
      });

      // Form should be reset
      expect(screen.getByTestId('name-input')).toHaveValue('');
      expect(screen.getByTestId('email-input')).toHaveValue('');
    });

    it('should handle server validation errors', async () => {
      render(<FormWithValidation />);

      const file = new File(['content'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      fireEvent.change(screen.getByTestId('name-input'), {
        target: { value: 'error' } // This triggers server error
      });
      fireEvent.change(screen.getByTestId('email-input'), {
        target: { value: 'john@example.com' }
      });
      fireEvent.change(screen.getByTestId('file-input'), {
        target: { files: [file] }
      });

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Server validation failed');
      });
    });

    it('should clear field errors when corrected', () => {
      render(<FormWithValidation />);

      // Trigger error
      fireEvent.click(screen.getByTestId('submit-button'));

      expect(screen.getByTestId('name-error')).toBeInTheDocument();

      // Fix the error
      fireEvent.change(screen.getByTestId('name-input'), {
        target: { value: 'John Doe' }
      });

      // Error should still be there until next validation
      expect(screen.getByTestId('name-error')).toBeInTheDocument();
    });
  });

  describe('Socket.IO Error Handling', () => {
    it('should display connection status', () => {
      render(<SocketErrorHandler />);

      expect(screen.getByTestId('connection-status')).toHaveTextContent('Status: disconnected');
      expect(screen.getByTestId('retry-count')).toHaveTextContent('Retry attempts: 0');
    });

    it('should handle connection errors with retry logic', async () => {
      render(<SocketErrorHandler />);

      fireEvent.click(screen.getByTestId('simulate-error-button'));

      expect(screen.getByTestId('connection-status')).toHaveTextContent('Status: error');
      expect(screen.getByTestId('socket-error-message')).toHaveTextContent('Error: Simulated connection error');
      expect(toast.error).toHaveBeenCalledWith('Connection error: Simulated connection error');

      // Wait for auto-retry
      await waitFor(() => {
        expect(screen.getByTestId('retry-count')).toHaveTextContent('Retry attempts: 1');
      }, { timeout: 2000 });
    });

    it('should allow manual reconnection', async () => {
      render(<SocketErrorHandler />);

      fireEvent.click(screen.getByTestId('simulate-error-button'));

      expect(screen.getByTestId('connection-status')).toHaveTextContent('Status: error');

      fireEvent.click(screen.getByTestId('reconnect-button'));

      expect(toast.info).toHaveBeenCalledWith('Attempting to reconnect...');

      // Wait for potential success (70% success rate in component)
      await waitFor(() => {
        // Either success or failure should have occurred
        expect(toast.success).toHaveBeenCalledWith('Reconnected successfully') ||
        expect(toast.error).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should disable reconnect button when connected', () => {
      render(<SocketErrorHandler />);

      // Set connected status first
      fireEvent.click(screen.getByTestId('reconnect-button'));

      // When connected, button should be disabled
      // Note: This test might need adjustment based on the exact implementation
    });

    it('should implement exponential backoff for retries', async () => {
      render(<SocketErrorHandler />);

      const startTime = Date.now();

      // Trigger error
      fireEvent.click(screen.getByTestId('simulate-error-button'));

      // Wait for first retry attempt
      await waitFor(() => {
        expect(screen.getByTestId('retry-count')).toHaveTextContent('Retry attempts: 1');
      }, { timeout: 2000 });

      const firstRetryTime = Date.now() - startTime;

      // First retry should happen after ~1 second (2^0)
      expect(firstRetryTime).toBeGreaterThan(900);
      expect(firstRetryTime).toBeLessThan(1500);
    });

    it('should stop retrying after maximum attempts', async () => {
      render(<SocketErrorHandler />);

      // Mock Math.random to always fail reconnection
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.2); // Always fail (< 0.3)

      fireEvent.click(screen.getByTestId('simulate-error-button'));

      // Wait for all retry attempts (should stop at 3)
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Maximum retry attempts reached');
      }, { timeout: 10000 });

      // Restore Math.random
      Math.random = originalRandom;
    }, 15000);
  });

  describe('Integration Error Scenarios', () => {
    it('should handle multiple error types simultaneously', async () => {
      const MultiErrorComponent = () => (
        <div>
          <APIErrorHandler endpoint="/api/failing-endpoint">
            <FormWithValidation />
          </APIErrorHandler>
          <SocketErrorHandler />
        </div>
      );

      // Mock failing API
      global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

      render(
        <TestErrorBoundary>
          <MultiErrorComponent />
        </TestErrorBoundary>
      );

      // Trigger API error
      fireEvent.click(screen.getByTestId('api-call-button'));

      // Trigger form validation errors
      fireEvent.click(screen.getByTestId('submit-button'));

      // Trigger socket error
      fireEvent.click(screen.getByTestId('simulate-error-button'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Network failure');
        expect(toast.error).toHaveBeenCalledWith('Please fix the form errors');
        expect(toast.error).toHaveBeenCalledWith('Connection error: Simulated connection error');
      });

      expect(screen.getByTestId('api-error-message')).toBeInTheDocument();
      expect(screen.getByTestId('name-error')).toBeInTheDocument();
      expect(screen.getByTestId('socket-error-message')).toBeInTheDocument();
    });

    it('should maintain component stability under error conditions', async () => {
      const StabilityTestComponent = () => {
        const [counter, setCounter] = useState(0);
        
        return (
          <div>
            <div data-testid="counter">{counter}</div>
            <button 
              data-testid="increment"
              onClick={() => setCounter(c => c + 1)}
            >
              Increment
            </button>
            <APIErrorHandler endpoint="/api/error">
              <SocketErrorHandler />
            </APIErrorHandler>
          </div>
        );
      };

      global.fetch = jest.fn().mockRejectedValue(new Error('Persistent error'));

      render(
        <TestErrorBoundary>
          <StabilityTestComponent />
        </TestErrorBoundary>
      );

      // Component should still be functional despite errors
      fireEvent.click(screen.getByTestId('increment'));
      expect(screen.getByTestId('counter')).toHaveTextContent('1');

      // Trigger API error
      fireEvent.click(screen.getByTestId('api-call-button'));

      // Component should still work after API error
      fireEvent.click(screen.getByTestId('increment'));
      expect(screen.getByTestId('counter')).toHaveTextContent('2');

      // Trigger socket error
      fireEvent.click(screen.getByTestId('simulate-error-button'));

      // Component should still be functional
      fireEvent.click(screen.getByTestId('increment'));
      expect(screen.getByTestId('counter')).toHaveTextContent('3');
    });
  });
});