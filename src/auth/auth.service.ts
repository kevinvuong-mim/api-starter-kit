import {
  Logger,
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';

import { DeviceInfo } from '@/common/utils';
import { LoginDto } from '@/auth/dto/login.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { GoogleAuthDto } from '@/auth/dto/google-auth.dto';
import { AUTH_CONSTANTS } from '@/auth/constants/auth.constants';
import { MailQueueService } from '@/mail/queue/mail-queue.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailQueueService: MailQueueService,
  ) {}

  private async generateTokens(userId: string, sessionId: string) {
    const payload = { sub: userId, sessionId };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: this.msToJwtExpirationString(
        AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRATION,
      ) as `${number}${'d' | 'h' | 'm' | 's'}`,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: this.msToJwtExpirationString(
        AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRATION,
      ) as `${number}${'d' | 'h' | 'm' | 's'}`,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async createSession(userId: string, deviceInfo?: DeviceInfo) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRATION);
    const absoluteExpiresAt = new Date(now.getTime() + AUTH_CONSTANTS.SESSION_ABSOLUTE_EXPIRATION);

    return this.prisma.session.create({
      data: {
        userId,
        expiresAt,
        refreshToken: '', // Will be updated after token generation
        absoluteExpiresAt,
        lastUsedAt: new Date(),
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
        deviceName: deviceInfo?.deviceName,
        deviceType: deviceInfo?.deviceType,
      },
    });
  }

  private async findSessionByRefreshToken(refreshToken: string) {
    let payload: { sub: string; sessionId: string };

    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; sessionId: string }>(
        refreshToken,
        { secret: process.env.JWT_REFRESH_SECRET },
      );
    } catch {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.userId !== payload.sub) {
      return null;
    }

    const isMatch = await bcrypt.compare(refreshToken, session.refreshToken);

    return isMatch ? session : null;
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const now = new Date();

    const activeTokens = await this.prisma.session.findMany({
      orderBy: { lastUsedAt: 'asc' },
      where: {
        userId,
        expiresAt: { gte: now },
        absoluteExpiresAt: { gte: now },
      },
    });

    // If at or over limit, delete the oldest session(s)
    if (activeTokens.length >= AUTH_CONSTANTS.MAX_CONCURRENT_SESSIONS) {
      const tokensToDelete = activeTokens.slice(
        0,
        activeTokens.length - AUTH_CONSTANTS.MAX_CONCURRENT_SESSIONS + 1,
      );

      await this.prisma.session.deleteMany({
        where: { id: { in: tokensToDelete.map((t) => t.id) } },
      });
    }
  }

  private msToJwtExpirationString(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0 && hours % 24 === 0) {
      return `${days}d`;
    }
    if (hours > 0 && minutes % 60 === 0) {
      return `${hours}h`;
    }
    if (minutes > 0 && seconds % 60 === 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }

  async register(registerDto: RegisterDto, frontendUrl: string) {
    const { email, password } = registerDto;

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) throw new ConflictException('Email already in use');

    // Hash password with bcrypt (salt rounds = 12 provides strong security without significant performance impact)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(verificationToken, 10);

    // Token expires in 48 hours
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 48);

    // Create new user with verification fields
    await this.prisma.user.create({
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
      data: {
        email,
        isEmailVerified: false,
        verificationTokenExpiry,
        password: hashedPassword,
        verificationToken: hashedToken,
      },
    });

    // Enqueue verification email for background processing
    try {
      await this.mailQueueService.enqueueVerificationEmail({
        email,
        token: verificationToken,
        frontendUrl,
      });
    } catch (error) {
      // Keep registration successful even if queue enqueue fails
      this.logger.error(
        'Failed to enqueue verification email job',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async login(loginDto: LoginDto, deviceInfo?: DeviceInfo) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorizedException('Invalid email or password');

    // Check if user has a password
    if (!user.password) {
      throw new UnauthorizedException(
        'This account does not have a password set. Please use Google login or reset your password.',
      );
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email address before logging in. Check your inbox for the verification link.',
      );
    }

    // Check if user is active
    if (!user.isActive) throw new UnauthorizedException('Account has been disabled');

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) throw new UnauthorizedException('Invalid email or password');

    // Check session limit
    await this.enforceSessionLimit(user.id);

    // Create session first to get session ID
    const session = await this.createSession(user.id, deviceInfo);

    // Generate tokens with session ID
    const tokens = await this.generateTokens(user.id, session.id);

    // Hash refresh token before storing
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

    // Update session with hashed refresh token
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: hashedRefreshToken },
    });

    // Return tokens in response body for localStorage storage
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, refreshToken: string) {
    if (!refreshToken) throw new BadRequestException('Refresh token not provided');

    const matchingSession = await this.findSessionByRefreshToken(refreshToken);

    if (!matchingSession || matchingSession.userId !== userId) {
      throw new BadRequestException('Invalid refresh token');
    }

    // Delete refresh token from database
    await this.prisma.session.delete({ where: { id: matchingSession.id } });
  }

  async refreshTokens(refreshToken: string, deviceInfo?: DeviceInfo) {
    if (!refreshToken) throw new BadRequestException('Refresh token not provided');

    const now = new Date();

    const tokenRecord = await this.findSessionByRefreshToken(refreshToken);

    if (!tokenRecord) throw new UnauthorizedException('Invalid refresh token');

    // Check if token has expired
    if (tokenRecord.expiresAt < now) {
      await this.prisma.session.delete({ where: { id: tokenRecord.id } });

      throw new UnauthorizedException('Refresh token has expired');
    }

    if (tokenRecord.absoluteExpiresAt < now) {
      await this.prisma.session.delete({ where: { id: tokenRecord.id } });

      throw new UnauthorizedException('Session has expired');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(tokenRecord.userId, tokenRecord.id);

    // Hash new refresh token before storing
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

    // Update session with new hashed refresh token
    await this.prisma.session.update({
      where: { id: tokenRecord.id },
      data: {
        lastUsedAt: new Date(),
        refreshToken: hashedRefreshToken,
        expiresAt: new Date(now.getTime() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRATION),
        // Update device info if provided
        ...(deviceInfo && {
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          deviceName: deviceInfo.deviceName,
          deviceType: deviceInfo.deviceType,
        }),
      },
    });

    // Return tokens in response body for localStorage storage
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async googleLogin(googleUser: GoogleAuthDto, deviceInfo?: DeviceInfo) {
    if (!googleUser) throw new BadRequestException('No user from Google');

    // Check if user exists with Google ID or email
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }] },
    });

    // If user exists by email but doesn't have Google linked yet
    if (user && !user.googleId) {
      // Link Google account to existing user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true, // Google login implies email is verified
          googleId: googleUser.googleId,
          avatar: user.avatar || googleUser.avatar,
          fullName: user.fullName || `${googleUser.firstName} ${googleUser.lastName}`,
        },
      });
    }

    // If user doesn't exist at all, create new user with Google
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          password: null,
          isEmailVerified: true, // Google accounts are pre-verified
          email: googleUser.email,
          avatar: googleUser.avatar,
          googleId: googleUser.googleId,
          fullName: `${googleUser.firstName} ${googleUser.lastName}`,
        },
      });
    }

    // Check if user is active
    if (!user.isActive) throw new UnauthorizedException('Account has been disabled');

    // Check session limit
    await this.enforceSessionLimit(user.id);

    // Create session first to get session ID
    const session = await this.createSession(user.id, deviceInfo);

    // Generate tokens with session ID
    const tokens = await this.generateTokens(user.id, session.id);

    // Hash refresh token before storing
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

    // Update session with hashed refresh token
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: hashedRefreshToken },
    });

    // Return tokens in response body for localStorage storage
    return tokens;
  }
}
