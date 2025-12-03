import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

global.fetch = jest.fn();

describe('Authentication Frontend Tests', () => {
  /**
   * Purpose: Reset fetch mock and set default API responses before each test
   * Input: None
   * Output: Configures mock fetch for /api/events and /me endpoints
   */
  beforeEach(() => {
    fetch.mockClear();
    fetch.mockImplementation((url) => {
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, name: 'Concert', date: '2025-12-01', tickets: 10 },
            { id: 2, name: 'Play', date: '2025-12-10', tickets: 5 }
          ])
        });
      }
      if (url.includes('/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  describe('Login Form', () => {
    /**
     * Purpose: Verifies login form renders with email, password, and submit button
     * Input: Unauthenticated state
     * Output: Login form elements visible in DOM
     */
    test('renders login form when not authenticated', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/login email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/login password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
      });
    });

    /**
     * Purpose: Verifies login form submits credentials to backend with correct format
     * Input: Email and password entered in login form
     * Output: POST request to /login with credentials and credentials: 'include'
     */
    test('login form submits with correct credentials', async () => {
      fetch.mockImplementation((url, options) => {
        if (url.includes('/api/events')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ authenticated: false })
          });
        }
        if (url.includes('/login') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ message: 'Logged in', email: 'test@example.com' })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      window.alert = jest.fn();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/login email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText(/login email/i);
      const passwordInput = screen.getByPlaceholderText(/login password/i);
      const loginButton = screen.getByRole('button', { name: /^login$/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:4000/login',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
          })
        );
      });
    });

    /**
     * Purpose: Verifies login form displays error alert on authentication failure
     * Input: Invalid credentials submitted to login form
     * Output: Alert shown with "Invalid credentials" message
     */
    test('login form shows error on invalid credentials', async () => {
      fetch.mockImplementation((url, options) => {
        if (url.includes('/api/events')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ authenticated: false })
          });
        }
        if (url.includes('/login')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: 'Invalid credentials' })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      window.alert = jest.fn();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/login email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText(/login email/i);
      const passwordInput = screen.getByPlaceholderText(/login password/i);
      const loginButton = screen.getByRole('button', { name: /^login$/i });

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Invalid credentials'));
      });
    });
  });

  describe('Registration Form', () => {
    /**
     * Purpose: Verifies registration form renders with email, password, and submit button
     * Input: Unauthenticated state
     * Output: Registration form elements visible in DOM
     */
    test('renders registration form when not authenticated', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/register email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/register password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^register$/i })).toBeInTheDocument();
      });
    });

    /**
     * Purpose: Verifies registration form submits new user data to backend
     * Input: Email and password entered in registration form
     * Output: POST request to /register with new user credentials
     */
    test('registration form submits correctly', async () => {
      fetch.mockImplementation((url, options) => {
        if (url.includes('/api/events')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ authenticated: false })
          });
        }
        if (url.includes('/register')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ message: 'Registered', email: 'newuser@example.com' })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      window.alert = jest.fn();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/register email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText(/register email/i);
      const passwordInput = screen.getByPlaceholderText(/register password/i);
      const registerButton = screen.getByRole('button', { name: /^register$/i });

      fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'newpass123' } });
      fireEvent.click(registerButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:4000/register',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'newuser@example.com', password: 'newpass123' })
          })
        );
      });
    });

    /**
     * Purpose: Verifies login and register forms use separate state variables
     * Input: Text entered in both login and register email fields
     * Output: Input values remain independent (typing in one doesn't affect the other)
     */
    test('registration and login forms have independent state', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/login email/i)).toBeInTheDocument();
      });

      const loginEmail = screen.getByPlaceholderText(/login email/i);
      const registerEmail = screen.getByPlaceholderText(/register email/i);

      fireEvent.change(loginEmail, { target: { value: 'login@test.com' } });
      
      expect(registerEmail.value).toBe('');
      
      fireEvent.change(registerEmail, { target: { value: 'register@test.com' } });
      
      expect(loginEmail.value).toBe('login@test.com');
      expect(registerEmail.value).toBe('register@test.com');
    });
  });

  describe('Authenticated State', () => {
    /**
     * Purpose: Verifies authenticated UI displays user email and auth buttons
     * Input: Authenticated session from /me endpoint
     * Output: "Logged in as" text, logout button, and view profile button visible
     */
    test('shows logged in state when authenticated', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/events')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ authenticated: true, email: 'user@example.com' })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Logged in as user@example.com/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /view profile/i })).toBeInTheDocument();
      });
    });

    /**
     * Purpose: Verifies logout button calls backend and clears session
     * Input: Click on logout button
     * Output: POST request to /logout with credentials: 'include'
     */
    test('logout button clears authentication', async () => {
      fetch.mockImplementation((url, options) => {
        if (url.includes('/api/events')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ authenticated: true, email: 'user@example.com' })
          });
        }
        if (url.includes('/logout')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ message: 'Logged out' })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      window.alert = jest.fn();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:4000/logout',
          expect.objectContaining({
            method: 'POST',
            credentials: 'include'
          })
        );
      });
    });

    test('view profile button displays profile data', async () => {
      fetch.mockImplementation((url, options) => {
        if (url.includes('/api/events')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ authenticated: true, email: 'user@example.com' })
          });
        }
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ email: 'user@example.com', id: '12345' })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view profile/i })).toBeInTheDocument();
      });

      const profileButton = screen.getByRole('button', { name: /view profile/i });
      fireEvent.click(profileButton);

      await waitFor(() => {
        expect(screen.getByText(/Profile Information/i)).toBeInTheDocument();
        expect(screen.getByText(/user@example.com/i)).toBeInTheDocument();
        expect(screen.getByText(/12345/i)).toBeInTheDocument();
      });
    });

    test('expired token redirects to login', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/events')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ authenticated: true, email: 'user@example.com' })
          });
        }
        if (url.includes('/profile')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: 'Expired or invalid token' })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      window.alert = jest.fn();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view profile/i })).toBeInTheDocument();
      });

      const profileButton = screen.getByRole('button', { name: /view profile/i });
      fireEvent.click(profileButton);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Session expired'));
      });
    });
  });
});
