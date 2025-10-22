document.addEventListener("DOMContentLoaded", () => {
  const layers = document.querySelectorAll(".layer");
  const loginCard = document.getElementById("loginCard");
  const container = document.querySelector(".container");
  const passwordInput = document.getElementById("passwordInput");
  const emailInput = document.querySelector('input[type="email"]');
  const recaptchaContainer = document.getElementById("recaptchaContainer");
  const loginButton = document.getElementById("loginButton");
  const loginForm = document.querySelector('form');

  // Handle password input
  passwordInput.addEventListener('input', function() {
    if (this.value.length >= 6) { // Minimum 6 characters
      recaptchaContainer.style.display = 'block';
      // Reset reCAPTCHA if it was previously solved
      if (typeof grecaptcha !== 'undefined') {
        grecaptcha.reset();
      }
    } else {
      recaptchaContainer.style.display = 'none';
      loginButton.disabled = true;
    }
  });

  // Handle email input
  emailInput.addEventListener('input', function() {
    validateForm();
  });

  // Validate form function
  function validateForm() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const isValidEmail = email && email.includes('@');
    const isValidPassword = password && password.length >= 6;
    
    if (isValidEmail && isValidPassword) {
      recaptchaContainer.style.display = 'block';
    } else {
      recaptchaContainer.style.display = 'none';
      loginButton.disabled = true;
    }
  }

  // Delay before animation starts
  setTimeout(() => {
    // Animate layers sliding in one by one
    layers.forEach((layer, index) => {
      setTimeout(() => {
        layer.classList.add("active");
      }, index * 600);
    });

    // After all layers are done, fade in the login form
    setTimeout(() => {
      loginCard.classList.add("show");

      // 👇 After form fades in, show background image
      setTimeout(() => {
        container.classList.add("show-bg");
      }, 800); // delay ensures layers + form animation are done
    }, layers.length * 600 + 400);
  }, 900);
});

// Enable submit button when reCAPTCHA is completed
function enableSubmit(token) {
    document.querySelector(".login-btn").disabled = false;
}

// Add form submission handling
document.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.querySelector('input[type="email"]').value.trim();
    const password = document.getElementById('passwordInput').value;
    const loginButton = document.querySelector(".login-btn");
    
    // Basic validation
    if (!email || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters long', 'error');
        return;
    }
    
    // Check reCAPTCHA if it's visible
    const recaptchaContainer = document.getElementById("recaptchaContainer");
    if (recaptchaContainer.style.display !== 'none') {
        const recaptchaResponse = grecaptcha.getResponse();
        if (!recaptchaResponse) {
            showMessage('Please complete the reCAPTCHA', 'error');
            return;
        }
    }
    
    // Disable button and show loading
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard for all users
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } else {
            showMessage(data.message || 'Login failed', 'error');
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
            
            // Reset reCAPTCHA
            if (typeof grecaptcha !== 'undefined') {
                grecaptcha.reset();
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});

// Show message function
function showMessage(message, type) {
    // Remove existing message
    const existingMessage = document.querySelector('.login-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `login-message ${type}`;
    messageDiv.textContent = message;
    
    // Style the message
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        max-width: 300px;
        word-wrap: break-word;
        ${type === 'success' ? 'background-color: #4CAF50;' : 'background-color: #f44336;'}
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(messageDiv);
    
    // Remove message after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}