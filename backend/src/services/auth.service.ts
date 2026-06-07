import { prisma } from "../config/db";
import { getRedis } from "../config/redis";
import { env } from "../config/env";
import { SignJWT, jwtVerify } from "jose";
import { pbkdf2Sync } from "crypto";

export async function hashPassword(password: string): Promise<string> {
  const hash = await Bun.password.hash(password, {
    algorithm: "argon2id",
    timeCost: 3,
    memoryCost: 12 * 1024, // 12 MB
  });
  return hash;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (stored.startsWith("pbkdf2:")) {
    try {
      const parts = stored.split(":");
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1]!, 10);
      const salt = parts[2]!;
      const hash = parts[3]!;
      const computedHash = pbkdf2Sync(
        password,
        salt,
        iterations,
        64,
        "sha512",
      ).toString("hex");
      return computedHash === hash;
    } catch {
      return false;
    }
  }

  try {
    const ifVerified = await Bun.password.verify(password, stored);
    return !!ifVerified;
  } catch {
    return false;
  }
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_KEY_PREFIX = "session:";
const SESSION_ISSUER = "samayak-api";
const SESSION_AUDIENCE = "samayak-web";
const SESSION_SECRET = new TextEncoder().encode(env.BETTER_AUTH_SECRET);

export async function createSession(userId: string): Promise<string> {
  const token = await new SignJWT()
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setJti(Bun.randomUUIDv7())
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(SESSION_SECRET);

  await getRedis().set(
    getSessionKey(token),
    userId,
    "EX",
    SESSION_TTL_SECONDS,
  );
  return token;
}

export async function getSessionUserId(
  token: string,
): Promise<string | null> {
  let userId: string;

  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    if (!payload.sub) return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const sessionUserId = await getRedis().get(getSessionKey(token));
  return sessionUserId === userId ? userId : null;
}

export async function destroySession(token: string): Promise<void> {
  await getRedis().del(getSessionKey(token));
}

function getSessionKey(token: string): string {
  const tokenHash = new Bun.CryptoHasher("sha256")
    .update(token)
    .digest("hex");
  return `${SESSION_KEY_PREFIX}${tokenHash}`;
}

export const AuthService = {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || user.isDeleted) {
      return { success: false as const, error: "Invalid email or password" };
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);

    // not valid password
    if (!passwordValid) {
      return { success: false as const, error: "Invalid email or password" };
    }

    const token = await createSession(user.id);
    return {
      success: true as const,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
      },
    };
  },

  async getUserFromToken(token: string) {
    const userId = await getSessionUserId(token);
    if (!userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isDeleted: true,
      },
    });
    if (!user || user.isDeleted) return null;
    return user;
  },

  async logout(token: string) {
    await destroySession(token);
  },
};
