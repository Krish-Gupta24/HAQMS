const jwt = require("jsonwebtoken");

// FIXED: Removed insecure hardcoded fallback secret.
// Application should rely on environment configuration.
const JWT_SECRET = process.env.JWT_SECRET;

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Access denied. No token provided.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // SECURITY BUG FIXED:
    // Removed ignoreExpiration:true so JWT expiry is enforced.
    // Also uses configured JWT secret only.
    const decoded = jwt.verify(token, JWT_SECRET);

    // Add user details to request object
    req.user = decoded;
    next();
  } catch (error) {
    // IMPROPER ERROR HANDLING FIXED:
    // Do not leak JWT verification internals to clients.
    return res.status(401).json({
      error: "Invalid or expired token.",
    });
  }
};

// Role authorization middleware
const authorize = (roles = []) => {
  if (typeof roles === "string") {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized. User context missing.",
      });
    }

    // Role-based verification
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden. Requires role: ${roles.join(" or ")}`,
      });
    }

    next();
  };
};

// MISSING AUTHORIZATION CHECK FIXED:
// Admin-only actions now verify the ADMIN role properly.
const authorizeAdminOnlyLegacy = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Unauthorized.",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      error: "Access denied. Admin only.",
    });
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  authorizeAdminOnlyLegacy,
};
