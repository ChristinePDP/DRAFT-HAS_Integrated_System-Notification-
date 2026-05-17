import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware
 *
 * This service expects the Adapter Layer (Group 2) to forward incoming requests
 * with a valid JWT token in the `Authorization: Bearer <token>` header. The
 * JWT is verified locally using the shared `JWT_SECRET` from the environment.
 *
 * On success the decoded token payload is attached to `req.user`.
 */
export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header is missing. Adapter Layer must forward a valid JWT token.',
        code: 'MISSING_AUTH_HEADER',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization header format. Expected: Authorization: Bearer <token>',
        code: 'INVALID_AUTH_FORMAT',
      });
    }

    const token = parts[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error: JWT configuration missing',
        code: 'JWT_CONFIG_ERROR',
      });
    }

    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    return next();

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token provided',
        code: 'INVALID_TOKEN',
        details: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR',
      details: error.message,
    });
  }
};

export default authMiddleware;