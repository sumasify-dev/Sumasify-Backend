import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { verifyGoogleCredential  } from "../../middleware/utils/googleAuth.js";
import { sendPasswordResetEmail } from "../../middleware/utils/email.js";
import { AppError } from "../../middleware/utils/AppError.js";

import { env } from "../../config/env.js";

import {
  findUserByEmail,
  createUser,
  findUserById,
  updateLastLogin,
  updatePassword,
  updateAccountStatus,
  createRefreshSession,
  findRefreshSessionByTokenHash,
  revokeAllRefreshSessionsByUserId,
  revokeRefreshSession,
  rotateRefreshSession,
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  markPasswordResetTokenAsUsed,
  deletePasswordResetTokensByUserId,
  findUserByGoogleId,
  linkGoogleAccount,
} from "./auth.model.js";

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_DAYS = 30;

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role.toLowerCase(),
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresInSeconds,
    }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createUserRefreshSession(user, req) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);

  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  );

  await createRefreshSession({
    userId: user.id,
    tokenHash,
    expiresAt,
    userAgent: req?.get("user-agent") || null,
  });

  return {refreshToken,expiresAt};
}

function toSafeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.toLowerCase(),
    accountStatus: user.accountStatus.toLowerCase(),
  };
}

function toAuthUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.toLowerCase(),
    accountStatus: user.accountStatus.toLowerCase(),
    vendor: user.vendor
      ? {
          id: user.vendor.id,
          businessName: user.vendor.businessName,
          status: user.vendor.status.toLowerCase(),
        }
      : null,
  };
}

export async function registerUser(data, req) {
  const existingUser = await findUserByEmail(data.email);

 if (existingUser) {
  throw new AppError(
    "Email is already registered",
    409,
    "DUPLICATE_RESOURCE"
  );
}

  const passwordHash = await bcrypt.hash(
    data.password,
    SALT_ROUNDS
  );

  const now = new Date();

  const user = await createUser({
    fullName: data.fullName ?? data.fullname,
    email: data.email,
    phoneE164: data.phone ?? null,
    passwordHash,
    role: "BUYER",
    agreedToTermsAt: now,
    agreedToPrivacyAt: now,
  });

  const accessToken = signAccessToken(user);

  const { refreshToken } = await createUserRefreshSession(
    user,
    req
  );

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
    expiresIn: env.jwtExpiresInSeconds,
  };
}

export async function loginUser(data, req) {
  const user = await findUserByEmail(data.email);

  if (!user) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  if (!user || !user.passwordHash) {
  throw new AppError(
    "Invalid email or password",
    401,
    "INVALID_CREDENTIALS"
  );
}

const isPasswordCorrect = await bcrypt.compare(
  data.password,
  user.passwordHash
);

if (!isPasswordCorrect) {
  throw new AppError(
    "Invalid email or password",
    401,
    "INVALID_CREDENTIALS"
  );
}

  if (
  user.accountStatus === "SUSPENDED" ||
  user.accountStatus === "DEACTIVATED"
) {
  throw new AppError(
    "This account is not active",
    403,
    user.accountStatus === "SUSPENDED"
      ? "ACCOUNT_SUSPENDED"
      : "ACCOUNT_DEACTIVATED"
  );
}

  await updateLastLogin(user.id);

  const accessToken = signAccessToken(user);

  const { refreshToken } = await createUserRefreshSession(
    user,
    req
  );

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
    expiresIn: env.jwtExpiresInSeconds,
  };
}

export async function googleAuth(data, req) {
  const googleUser = await verifyGoogleCredential(
    data.credential
  );

  if (!googleUser.emailVerified) {
  throw new AppError(
    "Google email must be verified",
    401,
    "UNAUTHORIZED"
  );
}
  
  let user = await findUserByGoogleId(
    googleUser.googleId
  );

  // Find existing SUMASIFY account
  if (!user) {
    user = await findUserByEmail(googleUser.email);

    if (user) {
      // Google ID belongs to another Google account
      if (
  user.googleId &&
  user.googleId !== googleUser.googleId
) {
  throw new AppError(
    "This email is already linked to another Google account",
    401,
    "UNAUTHORIZED"
  );
}

      // Link Google to existing account
      if (!user.googleId) {
        user = await linkGoogleAccount(
          user.id,
          googleUser.googleId
        );
      }
    }
  }

  // Create new SUMASIFY account
  if (!user) {
    const now = new Date();

    user = await createUser({
      email: googleUser.email,
      fullName: googleUser.fullName,
      googleId: googleUser.googleId,
      passwordHash: null,
      role: "BUYER",
      emailVerifiedAt: now,
      agreedToTermsAt: now,
      agreedToPrivacyAt: now,
    });
  }

  if (
  user.accountStatus === "SUSPENDED" ||
  user.accountStatus === "DEACTIVATED"
) {
  throw new AppError(
    "This account is not active",
    403,
    user.accountStatus === "SUSPENDED"
      ? "ACCOUNT_SUSPENDED"
      : "ACCOUNT_DEACTIVATED"
  );
}

  await updateLastLogin(user.id);

  const accessToken = signAccessToken(user);

  const { refreshToken } = await createUserRefreshSession(
    user,
    req
  );

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
    expiresIn: env.jwtExpiresInSeconds,
  }
}

export async function forgotPassword(data) {
  const user = await findUserByEmail(data.email);

  if (user) {
    await deletePasswordResetTokensByUserId(user.id);

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await sendPasswordResetEmail( user.email, rawToken);
  }

  return {
    message:
      "If an account with that email exists, a password reset link has been sent.",
  };
}

export async function resetPassword(data) {
  const tokenHash = hashToken(data.token);

  const resetToken = await findPasswordResetTokenByHash(
    tokenHash
  );

  if (!resetToken) {
  throw new AppError(
    "Invalid reset token",
    400,
    "VALIDATION_ERROR"
  );
}

  if (resetToken.usedAt) {
  throw new AppError(
    "Reset token has already been used",
    400,
    "VALIDATION_ERROR"
  );
}

if (resetToken.expiresAt <= new Date()) {
  throw new AppError(
    "Reset token has expired",
    400,
    "VALIDATION_ERROR"
  );
}
  const passwordHash = await bcrypt.hash(
    data.newPassword ?? data.newpassword,
    SALT_ROUNDS
  );

  await updatePassword(
    resetToken.userId,
    passwordHash
  );

  await markPasswordResetTokenAsUsed(
    resetToken.id
  );

  await revokeAllRefreshSessionsByUserId(
    resetToken.userId
  );
}

export async function refreshUserSession(refreshToken, req) {
  if (!refreshToken) {
  throw new AppError(
    "Refresh token is required",
    401,
    "UNAUTHORIZED"
  );
}

  const tokenHash = hashToken(refreshToken);

  // Find the current session so we can identify the user.
  const session = await findRefreshSessionByTokenHash(
    tokenHash
  );

  if (!session) {
  throw new AppError(
    "Invalid or expired refresh token",
    401,
    "UNAUTHORIZED"
  );
}

if (session.revokedAt) {
  throw new AppError(
    "Invalid or expired refresh token",
    401,
    "UNAUTHORIZED"
  );
}

if (session.expiresAt <= new Date()) {
  throw new AppError(
    "Invalid or expired refresh token",
    401,
    "UNAUTHORIZED"
  );
}

  const user = await findUserById(session.userId);

  if (!user) {
  throw new AppError(
    "User not found",
    401,
    "UNAUTHORIZED"
  );
}

 if (
  user.accountStatus === "SUSPENDED" ||
  user.accountStatus === "DEACTIVATED"
) {
  throw new AppError(
    "This account is not active",
    403,
    user.accountStatus === "SUSPENDED"
      ? "ACCOUNT_SUSPENDED"
      : "ACCOUNT_DEACTIVATED"
  );
}

  // Generate the replacement refresh token.
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRefreshToken);

  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    // Atomically revoke the old session and create the new one.
    await rotateRefreshSession({
      tokenHash,
      newTokenHash,
      expiresAt,
      userAgent: req?.get("user-agent") || null,
    });
  } catch (err) {
    if (
      err.code === "REFRESH_SESSION_NOT_FOUND" ||
      err.code === "REFRESH_SESSION_REVOKED" ||
      err.code === "REFRESH_SESSION_EXPIRED"
    ) {
      throw new AppError(
  "Invalid or expired refresh token",
  401,
  "UNAUTHORIZED"
);
    }

    throw err;
  }

  const accessToken = signAccessToken(user);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: env.jwtExpiresInSeconds,
  };
}

export async function getUserById(id) {
  const user = await findUserById(id);

  if (!user) {
  throw new AppError(
    "User not found",
    404,
    "NOT_FOUND"
  );
}

  return toAuthUser(user);
}

export async function deactivateUserAccount(id) {
  await updateAccountStatus(id, "DEACTIVATED");

  await revokeAllRefreshSessionsByUserId(id);

  return {
    message: "Account deactivated successfully",
  };
}

export async function logoutUser(refreshToken) {
 if (!refreshToken) {
  throw new AppError(
    "Refresh token is required",
    401,
    "UNAUTHORIZED"
  );
}

const tokenHash = hashToken(refreshToken);

const session = await findRefreshSessionByTokenHash(tokenHash);

if (!session) {
  throw new AppError(
    "Invalid refresh token",
    401,
    "UNAUTHORIZED"
  );
}

  if (!session.revokedAt) {
    await revokeRefreshSession(session.id);
  }
}