const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const authRepository = require('./auth.repository');

/**
 * Auth service — business logic for authentication.
 */
const authService = {
  /**
   * Register a new user.
   * @param {object} data - { email, name, password }
   * @returns {Promise<{ user: object, token: string }>}
   * @throws {Error} If email already exists
   */
  async register({ email, name, password }) {
    // Check if email is already taken
    const existingUser = await authRepository.findByEmail(email);
    if (existingUser) {
      const error = new Error('An account with this email already exists.');
      error.statusCode = 409;
      throw error;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await authRepository.create({ email, name, passwordHash });

    // Generate JWT
    const token = this._generateToken(user);

    return { user, token };
  },

  /**
   * Login a user.
   * @param {object} data - { email, password }
   * @returns {Promise<{ user: object, token: string }>}
   * @throws {Error} If credentials are invalid
   */
  async login({ email, password }) {
    // Find user by email (includes passwordHash for verification)
    const user = await authRepository.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT
    const token = this._generateToken(user);

    // Return user without passwordHash
    const { passwordHash: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  },

  /**
   * Get current user profile.
   * @param {string} userId
   * @returns {Promise<object>}
   * @throws {Error} If user not found
   */
  async getProfile(userId) {
    const user = await authRepository.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }
    return user;
  },

  /**
   * Generate a JWT token for a user.
   * @param {object} user - { id, email, name }
   * @returns {string}
   * @private
   */
  _generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );
  },
};

module.exports = authService;
