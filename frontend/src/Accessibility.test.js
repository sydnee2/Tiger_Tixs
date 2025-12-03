import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

global.fetch = jest.fn();

describe('Accessibility Tests', () => {
  /**
   * Purpose: Set up mock API responses before each test
   * Input: None
   * Output: Configures fetch mock to return sample events and auth status
   */
  beforeEach(() => {
    fetch.mockClear();
    fetch.mockImplementation((url) => {
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, name: 'Concert', date: '2025-12-01', tickets: 10 },
            { id: 2, name: 'Play', date: '2025-12-10', tickets: 5 },
            { id: 3, name: 'Basketball', date: '2025-11-20', tickets: 0 }
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

  describe('ARIA Labels and Roles', () => {
    /**
     * Purpose: Verifies main heading has proper semantic heading role
     * Input: Rendered App component
     * Output: H1 element with "Clemson Campus Events" accessible via role
     */
    test('main heading has proper heading role', async () => {
      render(<App />);
      
      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /Clemson Campus Events/i });
        expect(heading).toBeInTheDocument();
      });
    });

    /**
     * Purpose: Verifies event items have descriptive aria-labels for screen readers
     * Input: Rendered events list
     * Output: Article elements with aria-label attribute describing each event
     */
    test('event articles have aria-labels', async () => {
      render(<App />);
      
      await waitFor(() => {
        const concertArticle = screen.getByLabelText(/Event: Concert/i);
        expect(concertArticle).toBeInTheDocument();
        expect(concertArticle.tagName).toBe('ARTICLE');
      });
    });

    /**
     * Purpose: Verifies action buttons have clear
     * Input: Rendered buy ticket buttons
     * Output: Buttons with aria-label describing the action and event name
     */
    test('buy ticket buttons have descriptive aria-labels', async () => {
      render(<App />);
      
      await waitFor(() => {
        const buyButton = screen.getByLabelText(/Buy ticket for Concert/i);
        expect(buyButton).toBeInTheDocument();
        expect(buyButton).toHaveAttribute('aria-label');
      });
    });

    /**
     * Purpose: Verifies disabled buttons properly communicate unavailability
     * Input: Sold out event buttons
     * Output: Buttons with aria-disabled="true" and disabled attribute
     */
    test('sold out buttons have appropriate aria-disabled', async () => {
      render(<App />);
      
      await waitFor(() => {
        const soldOutButton = screen.getByLabelText(/Basketball is sold out/i);
        expect(soldOutButton).toBeInTheDocument();
        expect(soldOutButton).toHaveAttribute('aria-disabled', 'true');
        expect(soldOutButton).toBeDisabled();
      });
    });

    /**
     * Purpose: Verifies live regions for dynamic content updates
     * Input: Voice assistant chat window element
     * Output: Element with aria-live="polite" for non-intrusive announcements
     */
    test('voice assistant chat window has aria-live for screen readers', async () => {
      render(<App />);
      
      await waitFor(() => {
        const chatWindow = document.getElementById('chat-window');
        expect(chatWindow).toBeInTheDocument();
        expect(chatWindow).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    /**
     * Purpose: Verifies main heading can receive keyboard focus
     * Input: Rendered heading element
     * Output: Heading with tabIndex="0" allowing keyboard focus
     */
    test('main heading is keyboard focusable', async () => {
      render(<App />);
      
      await waitFor(() => {
        const heading = screen.getByText(/Clemson Campus Events/i);
        expect(heading).toHaveAttribute('tabIndex', '0');
      });
    });

    /**
     * Purpose: Verifies event cards can be navigated with keyboard
     * Input: Rendered event article elements
     * Output: All articles have tabIndex="0" for keyboard accessibility
     */
    test('event articles are keyboard focusable', async () => {
      render(<App />);
      
      await waitFor(() => {
        const articles = screen.getAllByRole('article');
        articles.forEach(article => {
          expect(article).toHaveAttribute('tabIndex', '0');
        });
      });
    });

    /**
     * Purpose: Verifies all buttons are semantic and keyboard accessible
     * Input: All button elements in the app
     * Output: Elements use proper <button> tags (not divs with click handlers)
     */
    test('buttons are keyboard accessible', async () => {
      render(<App />);
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
        buttons.forEach(button => {
          expect(button.tagName).toBe('BUTTON');
        });
      });
    });

    /**
     * Purpose: Verifies form inputs are keyboard navigable and properly labeled
     * Input: Login and register form input fields
     * Output: All inputs use <input> tags and are focusable via Tab key
     */
    test('form inputs are keyboard accessible', async () => {
      render(<App />);
      
      await waitFor(() => {
        const loginEmail = screen.getByPlaceholderText(/login email/i);
        const loginPassword = screen.getByPlaceholderText(/login password/i);
        const registerEmail = screen.getByPlaceholderText(/register email/i);
        const registerPassword = screen.getByPlaceholderText(/register password/i);
        
        expect(loginEmail.tagName).toBe('INPUT');
        expect(loginPassword.tagName).toBe('INPUT');
        expect(registerEmail.tagName).toBe('INPUT');
        expect(registerPassword.tagName).toBe('INPUT');
      });
    });
  });

  describe('Form Accessibility', () => {
    /**
     * Purpose: Verifies password fields hide input for security
     * Input: Password input elements
     * Output: All password inputs have type="password" attribute
     */
    test('password inputs have correct type', async () => {
      render(<App />);
      
      await waitFor(() => {
        const passwordInputs = screen.getAllByPlaceholderText(/password/i);
        passwordInputs.forEach(input => {
          expect(input).toHaveAttribute('type', 'password');
        });
      });
    });

    /**
     * Purpose: Verifies forms have proper submit buttons with correct type
     * Input: Login and register forms
     * Output: Submit buttons with type="submit" for form submission
     */
    test('forms have submit buttons', async () => {
      render(<App />);
      
      await waitFor(() => {
        const loginButton = screen.getByRole('button', { name: /^login$/i });
        const registerButton = screen.getByRole('button', { name: /^register$/i });
        
        expect(loginButton).toHaveAttribute('type', 'submit');
        expect(registerButton).toHaveAttribute('type', 'submit');
      });
    });

    /**
     * Purpose: Verifies input fields have placeholder text for guidance
     * Input: All form input fields
     * Output: Inputs have descriptive placeholder attributes for screen readers
     */
    test('input fields have placeholder text for screen readers', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/login email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/login password/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/register email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/register password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Visual Focus Indicators', () => {
    /**
     * Purpose: Verifies available action buttons have visible focus outline
     * Input: Buy ticket buttons for events with available tickets
     * Output: Orange outline for visual focus indication
     */
    test('buy ticket buttons have visible outline styles', async () => {
      render(<App />);
      
      await waitFor(() => {
        const availableButton = screen.getByLabelText(/Buy ticket for Concert/i);
        expect(availableButton).toHaveStyle('outline: 2px solid orange');
      });
    });

    /**
     * Purpose: Verifies disabled buttons have distinct visual appearance
     * Input: Sold out event buttons
     * Output: Purple outline to distinguish from active buttons
     */
    test('sold out buttons have distinct visual style', async () => {
      render(<App />);
      
      await waitFor(() => {
        const soldOutButton = screen.getByLabelText(/Basketball is sold out/i);
        expect(soldOutButton).toHaveStyle('outline: 2px solid purple');
      });
    });
  });

  describe('Semantic HTML', () => {
    /**
     * Purpose: Verifies page uses semantic <main> landmark
     * Input: Rendered App component
     * Output: Main element wrapping primary content with App class
     */
    test('uses semantic main element', async () => {
      render(<App />);
      
      await waitFor(() => {
        const main = document.querySelector('main');
        expect(main).toBeInTheDocument();
        expect(main).toHaveClass('App');
      });
    });

    /**
     * Purpose: Verifies events use semantic <article> elements
     * Input: Rendered event list
     * Output: Article elements for each independent content piece
     */
    test('uses semantic article elements for events', async () => {
      render(<App />);
      
      await waitFor(() => {
        const articles = screen.getAllByRole('article');
        expect(articles.length).toBeGreaterThan(0);
      });
    });

    /**
     * Purpose: Verifies auth area uses semantic <section> element
     * Input: Authentication controls section
     * Output: Section elements grouping related authentication content
     */
    test('uses semantic section for auth area', async () => {
      render(<App />);
      
      await waitFor(() => {
        const sections = document.querySelectorAll('section');
        expect(sections.length).toBeGreaterThan(0);
      });
    });

    /**
     * Purpose: Verifies forms use semantic <form> elements
     * Input: Login and register form containers
     * Output: Two form elements (login and register) with proper structure
     */
    test('uses semantic form elements', async () => {
      render(<App />);
      
      await waitFor(() => {
        const forms = document.querySelectorAll('form');
        expect(forms.length).toBe(2); // login and register forms
      });
    });
  });

  describe('Screen Reader Support', () => {
    /**
     * Purpose: Verifies voice assistant button has accessible text content
     * Input: Microphone button element
     * Output: Button element with emoji and text "🎤 Speak"
     */
    test('microphone button has accessible text', async () => {
      render(<App />);
      
      await waitFor(() => {
        const micButton = screen.getByText(/🎤 Speak/i);
        expect(micButton).toBeInTheDocument();
        expect(micButton.tagName).toBe('BUTTON');
      });
    });

    /**
     * Purpose: Verifies ticket availability is clearly communicated
     * Input: Event ticket counts in UI
     * Output: Text elements announcing availability (10, 5, 0 tickets)
     */
    test('event tickets availability is announced', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/Tickets available: 10/i)).toBeInTheDocument();
        expect(screen.getByText(/Tickets available: 5/i)).toBeInTheDocument();
        expect(screen.getByText(/Tickets available: 0/i)).toBeInTheDocument();
      });
    });

    /**
     * Purpose: Verifies authentication status is visible to screen readers
     * Input: Authenticated user state
     * Output: Text element showing "Logged in as user@example.com"
     */
    test('logged in status is visible to screen readers', async () => {
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
        const loginStatus = screen.getByText(/Logged in as user@example.com/i);
        expect(loginStatus).toBeInTheDocument();
      });
    });
  });
});
