/* eslint-disable no-console */
/* global google */
// Google OAuth Modal - FUNCTIONAL MODAL VERSION
// This version shows Google authentication modal on the login page
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== GOOGLE OAUTH MODAL SCRIPT LOADED ===');

    // Initialize Google Sign-In with modal approach
    function initializeGoogleSignIn() {
        console.log('Initializing Google Sign-In with modal approach...');
        console.log('Google object available:', typeof google !== 'undefined');
        console.log('Google accounts available:', typeof google !== 'undefined' && google.accounts);
        console.log('Google accounts.id available:', typeof google !== 'undefined' && google.accounts && google.accounts.id);

        const container = document.getElementById('google-signin-button');
        console.log('Container found:', !!container);
        console.log('Container element:', container);

        if (!container) {
            console.error('Google sign-in button container not found');
            console.log('Available elements with IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
            return;
        }

        // Check if GSI is disabled due to previous errors
        if (window.gsiDisabled) {
            console.log('GSI is disabled due to previous errors, using fallback...');
            initializeWithFallback();
            return;
        }

        // Try Google Identity Services first (if available)
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            console.log('Google Identity Services available, trying modal approach...');
            // Set a timeout for GSI initialization
            const gsiTimeout = setTimeout(() => {
                console.log('GSI initialization timeout reached, falling back to traditional OAuth...');
                window.gsiDisabled = true; // Disable GSI after timeout
                initializeWithFallback();
            }, 10000); // 10 seconds timeout

            initializeWithGSI(gsiTimeout);
        } else {
            console.log('Google Identity Services not available, using fallback button...');
            console.log('Creating fallback button immediately...');
            initializeWithFallback();
        }
    }

    // Initialize with Google Identity Services (modal approach)
    function initializeWithGSI(gsiTimeout) {
        const container = document.getElementById('google-signin-button');

        // Get Google client ID
        fetch('/auth/google/modal')
        .then(response => response.json())
        .then(config => {
            if (!config.success || !config.clientId) {
                throw new Error('Failed to get Google client ID');
            }

            console.log('Google client ID received:', config.clientId);

            // Initialize Google Identity Services for modal
            try {
                google.accounts.id.initialize({
                    client_id: config.clientId,
                    callback: function(response) {
                        clearModalTimeout();
                        handleCredentialResponse(response);
                    },
                    auto_select: false,
                    cancel_on_tap_outside: false,
                    ux_mode: 'popup',
                    context: 'signin',
                    use_fedcm_for_prompt: false,
                    itp_support: false
                });

                // Render the Google sign-in button
                google.accounts.id.renderButton(container, {
                    theme: 'outline',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'rectangular',
                    logo_alignment: 'left',
                    width: '100%',
                    type: 'standard'
                });

                console.log('Google Identity Services button rendered successfully');
                // Clear the timeout since GSI initialized successfully
                clearTimeout(gsiTimeout);
            } catch (error) {
                console.error('Error initializing/rendering GSI:', error);
                clearTimeout(gsiTimeout);
                window.gsiDisabled = true;
                initializeWithFallback();
            }
        })
        .catch(error => {
            console.error('Error initializing GSI:', error);
            clearTimeout(gsiTimeout);
            window.gsiDisabled = true;
            initializeWithFallback();
        });
    }

    // Initialize with fallback button (traditional OAuth)
    function initializeWithFallback() {
        const container = document.getElementById('google-signin-button');
        console.log('Creating fallback button in container:', container);

        // Clear any existing content
        container.innerHTML = '';

        // Create the fallback button
        const button = document.createElement('button');
        button.type = 'button';
        button.onclick = function() {
            console.log('Fallback button clicked! Redirecting to /auth/google');
            window.location.href = '/auth/google';
        };
        button.style.cssText = `
            width: 100%;
            padding: 12px 16px;
            background: white;
            border: 1px solid #dadce0;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            font-size: 14px;
            font-weight: 500;
            color: #3c4043;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;

        // Add hover effects
        button.onmouseover = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        };
        button.onmouseout = function() {
            this.style.backgroundColor = 'white';
            this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        };

        // Add Google icon SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('fill', '#4285F4');
        path1.setAttribute('d', 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z');
        const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path2.setAttribute('fill', '#34A853');
        path2.setAttribute('d', 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z');
        const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path3.setAttribute('fill', '#FBBC05');
        path3.setAttribute('d', 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z');
        const path4 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path4.setAttribute('fill', '#EA4335');
        path4.setAttribute('d', 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z');
        svg.appendChild(path1);
        svg.appendChild(path2);
        svg.appendChild(path3);
        svg.appendChild(path4);

        // Add text
        const text = document.createTextNode('Sign in with Google');

        button.appendChild(svg);
        button.appendChild(text);
        container.appendChild(button);

        console.log('Google Sign-In button created with fallback method');
    }

    // Handle Google credential response (for GSI modal)
    function handleCredentialResponse(response) {
        console.log('=== GOOGLE CREDENTIAL RECEIVED ===');
        console.log('Credential length:', response.credential ? response.credential.length : 'null');

        // Clear modal interaction timeout since we got a response
        clearModalTimeout();

        if (!response || !response.credential) {
            console.error('No credential received from Google');
            return;
        }

        // Show loading state
        const container = document.getElementById('google-signin-button');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;"><div style="border: 3px solid #f3f3f3; border-top: 3px solid #4285f4; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div><p>Signing in...</p></div>';
        }

        // Set a timeout for the backend authentication request
        const authTimeout = setTimeout(() => {
            console.log('Backend authentication timeout reached, falling back...');
            alert('Authentication is taking too long. Please try again.');
            initializeGoogleSignIn();
        }, 15000); // 15 seconds timeout for backend response

        // Send credential to backend
        fetch('/auth/google-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                credential: response.credential
            })
        })
        .then(response => {
            console.log('Backend response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Backend response:', data);
            // Clear the timeout since we got a response
            clearTimeout(authTimeout);

            if (data.success) {
                console.log('Login successful! Redirecting to auth-success...');
                // Redirect to auth-success for proper role handling
                window.location.href = '/auth-success';
            } else {
                console.error('Login failed:', data.message);
                alert('Login failed: ' + data.message);
                // Re-initialize button
                initializeGoogleSignIn();
            }
        })
        .catch(error => {
            console.error('Error during authentication:', error);
            clearTimeout(authTimeout);
            alert('Authentication error: ' + error.message);
            // Re-initialize button
            initializeGoogleSignIn();
        });
    }

    // Add global error handler for Google Identity Services
    window.addEventListener('error', (event) => {
        console.log('=== GLOBAL ERROR DETECTED ===');
        console.log('Error message:', event.message);
        console.log('Error source:', event.filename);
        console.log('Error line:', event.lineno);

        // Handle postMessage errors (null reference issues)
        if (event.message && event.message.includes('postMessage')) {
            console.error('Google Identity Services postMessage error:', event);
            console.log('This is likely the gsi/transform null reference issue!');
            console.log('Falling back to traditional OAuth redirect...');
            // Prevent further GSI attempts
            window.gsiDisabled = true;
            initializeWithFallback();
        }

        // Handle gsi/transform errors
        if (event.message && event.message.includes('gsi/transform')) {
            console.error('GSI Transform error detected:', event);
            console.log('This is the gsi/transform freeze issue!');
            console.log('Aborting any ongoing gsi/transform requests...');
            // Prevent further GSI attempts
            window.gsiDisabled = true;
            // Force fallback immediately
            setTimeout(() => initializeWithFallback(), 100);
        }

        // Handle null reference errors in transform layer
        if (event.message && event.message.includes('Cannot read properties of null')) {
            console.error('Null reference error in GSI transform layer:', event);
            console.log('This is a critical GSI library error, falling back...');
            window.gsiDisabled = true;
            initializeWithFallback();
        }
    });

    // Add unhandled promise rejection handler for fetch timeouts
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.name === 'AbortError') {
            console.log('=== FETCH REQUEST ABORTED ===');
            console.log('This might be due to gsi/transform timeout');
            console.log('Falling back to traditional OAuth...');
            initializeWithFallback();
        }
    });

    // Monitor network requests for gsi/transform
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string' && url.includes('gsi/transform')) {
            console.log('=== GSI TRANSFORM REQUEST DETECTED ===');
            console.log('URL:', url);
            console.log('This is the problematic gsi/transform endpoint!');

            // Create AbortController to timeout the request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log('Aborting gsi/transform request due to timeout');
                controller.abort();
            }, 5000); // 5 seconds timeout for gsi/transform

            // Modify args to include signal
            const modifiedArgs = [...args];
            if (modifiedArgs.length > 1 && typeof modifiedArgs[1] === 'object') {
                modifiedArgs[1].signal = controller.signal;
            } else {
                modifiedArgs[1] = { signal: controller.signal };
            }

            // Call original fetch with modified args
            const promise = originalFetch.apply(this, modifiedArgs);

            // Clear timeout if request completes
            promise.finally(() => clearTimeout(timeoutId));

            return promise;
        }
        return originalFetch.apply(this, args);
    };

    // Global timeout for modal interaction
    let modalInteractionTimeout;

    // Wait a bit for Google Identity Services to load, then initialize
    setTimeout(() => {
        // Check if we should skip GSI entirely
        if (window.gsiDisabled) {
            console.log('GSI disabled from previous session, using fallback...');
            initializeWithFallback();
        } else {
            initializeGoogleSignIn();
        }
    }, 500);

    // Function to start modal interaction timeout
    function startModalTimeout() {
        modalInteractionTimeout = setTimeout(() => {
            console.log('Modal interaction timeout reached, falling back to traditional OAuth...');
            alert('The sign-in process is taking too long. Switching to alternative method.');
            initializeWithFallback();
        }, 15000); // 15 seconds for complete modal interaction
    }

    // Function to clear modal interaction timeout
    function clearModalTimeout() {
        if (modalInteractionTimeout) {
            clearTimeout(modalInteractionTimeout);
            modalInteractionTimeout = undefined;
        }
    }

    // Override the renderButton to add click listener for timeout
    const originalRenderButton = google.accounts.id.renderButton;
    google.accounts.id.renderButton = function(container, options) {
        // Start timeout when button is rendered
        startModalTimeout();

        return originalRenderButton.call(this, container, options);
    };
});

// Add CSS for any loading states if needed
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
/* eslint-enable no-console */
