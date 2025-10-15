import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_change_this';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1h';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
}

export const authUtils = {
  // Hash password
  hashPassword: async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  },

  // Compare password
  comparePassword: async (password: string, hashedPassword: string): Promise<boolean> => {
    return await bcrypt.compare(password, hashedPassword);
  },

  // Generate access token
  generateAccessToken: (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
  },

  // Generate refresh token
  generateRefreshToken: (payload: TokenPayload): string => {
    return jwt.sign({ ...payload, tokenId: uuidv4() }, JWT_REFRESH_SECRET, { 
      expiresIn: JWT_REFRESH_EXPIRE 
    });
  },

  // Verify access token
  verifyAccessToken: (token: string): TokenPayload | null => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  },

  // Verify refresh token
  verifyRefreshToken: (token: string): any | null => {
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
      return decoded;
    } catch (error) {
      return null;
    }
  },

  // Generate both tokens
  generateTokens: (payload: TokenPayload) => {
    return {
      accessToken: authUtils.generateAccessToken(payload),
      refreshToken: authUtils.generateRefreshToken(payload)
    };
  }
};

export default authUtils;
