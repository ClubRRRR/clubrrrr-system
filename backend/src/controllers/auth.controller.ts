import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { query } from '../config/database';
import { authUtils } from '../utils/auth.utils';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export const authController = {
  // Register new user
  register: asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400);
    }

    const { email, password, firstName, lastName, phone, role = 'student' } = req.body;

    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const passwordHash = await authUtils.hashPassword(password);

    // Insert user
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'active') 
       RETURNING id, email, first_name, last_name, phone, role, status, created_at`,
      [email, passwordHash, firstName, lastName, phone, role]
    );

    const user = result.rows[0];

    // Generate tokens
    const tokens = authUtils.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokens.refreshToken, expiresAt]
    );

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          status: user.status
        },
        ...tokens
      }
    });
  }),

  // Login
  login: asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400);
    }

    const { email, password } = req.body;

    // Find user
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = result.rows[0];

    // Check if user is active
    if (user.status !== 'active') {
      throw new AppError('Account is inactive', 403);
    }

    // Verify password
    const isValidPassword = await authUtils.comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate tokens
    const tokens = authUtils.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokens.refreshToken, expiresAt]
    );

    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          status: user.status,
          avatarUrl: user.avatar_url
        },
        ...tokens
      }
    });
  }),

  // Refresh token
  refreshToken: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    // Verify refresh token
    const decoded = authUtils.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Check if token exists in database
    const tokenResult = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > CURRENT_TIMESTAMP',
      [refreshToken, decoded.userId]
    );

    if (tokenResult.rows.length === 0) {
      throw new AppError('Refresh token not found or expired', 401);
    }

    // Get user
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1 AND status = $2',
      [decoded.userId, 'active']
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found or inactive', 401);
    }

    const user = userResult.rows[0];

    // Generate new tokens
    const newTokens = authUtils.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Delete old refresh token and store new one
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, newTokens.refreshToken, expiresAt]
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: newTokens
    });
  }),

  // Logout
  logout: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    logger.info(`User logged out: ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  }),

  // Get current user
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const result = await query(
      'SELECT id, email, first_name, last_name, phone, role, status, avatar_url, created_at FROM users WHERE id = $1',
      [req.user?.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at
      }
    });
  }),

  // Update profile
  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const { firstName, lastName, phone, avatarUrl } = req.body;
    const userId = req.user?.userId;

    const result = await query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           avatar_url = COALESCE($4, avatar_url)
       WHERE id = $5
       RETURNING id, email, first_name, last_name, phone, role, avatar_url`,
      [firstName, lastName, phone, avatarUrl, userId]
    );

    const user = result.rows[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatar_url
      }
    });
  }),

  // Change password
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters', 400);
    }

    // Get current password hash
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    // Verify current password
    const isValidPassword = await authUtils.comparePassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash new password
    const newPasswordHash = await authUtils.hashPassword(newPassword);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Delete all refresh tokens to force re-login
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

    logger.info(`Password changed for user: ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  }),

  // Forgot password (placeholder - requires email service)
  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    // In production, send reset email
    // For now, just log
    logger.info(`Password reset requested for: ${email}`);

    res.json({
      success: true,
      message: 'If email exists, password reset instructions have been sent'
    });
  }),

  // Reset password (placeholder)
  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    // In production, verify token and reset password
    logger.info(`Password reset attempted with token`);

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  })
};

export default authController;
