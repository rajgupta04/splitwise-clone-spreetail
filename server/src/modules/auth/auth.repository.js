const prisma = require('../../config/database');

/**
 * Auth repository — data access layer for user authentication.
 */
const authRepository = {
  /**
   * Find a user by email.
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  },

  /**
   * Find a user by ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /**
   * Create a new user.
   * @param {object} data - { email, name, passwordHash }
   * @returns {Promise<object>}
   */
  async create({ email, name, passwordHash }) {
    return prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  },
};

module.exports = authRepository;
