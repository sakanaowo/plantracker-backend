import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { GoogleAuthService } from './google-auth.service';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Public } from '../../auth/public.decorator';

@ApiTags('Google Calendar Authentication')
@Controller('auth/google')
export class GoogleAuthController {
  constructor(private googleAuthService: GoogleAuthService) {}

  @Get('auth-url')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Google OAuth URL for Calendar access' })
  async getAuthUrl(@CurrentUser('id') userId: string) {
    const authUrl = this.googleAuthService.getAuthUrl(userId);
    return { authUrl };
  }

  @Get('callback')
  @Public() // Allow Google to call this endpoint without authentication
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    console.log('=== OAuth Callback Debug ===');
    console.log('code:', code ? 'EXISTS' : 'MISSING');
    console.log('state (userId):', userId);
    console.log('===========================');

    try {
      // Validate parameters
      if (!code) {
        return this.sendRedirectPage(
          res,
          'plantracker://calendar/connected?success=false&error=No authorization code',
        );
      }

      if (!userId) {
        return this.sendRedirectPage(
          res,
          'plantracker://calendar/connected?success=false&error=No token provided',
        );
      }

      const result = await this.googleAuthService.handleCallback(code, userId);

      // Send HTML page that redirects to Android app
      return this.sendRedirectPage(
        res,
        `plantracker://calendar/connected?success=true&email=${encodeURIComponent(result.accountEmail || 'unknown')}`,
      );
    } catch (error) {
      // Send HTML page with error redirect
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('OAuth callback error:', errorMessage);
      return this.sendRedirectPage(
        res,
        `plantracker://calendar/connected?success=false&error=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  /**
   * Send HTML page that redirects to deep link
   * This is needed because Chrome Custom Tabs can't directly redirect to plantracker://
   */
  private sendRedirectPage(res: Response, deepLink: string) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 { margin: 0 0 10px 0; font-size: 24px; }
    p { margin: 5px 0; opacity: 0.9; }
    .manual-link {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .manual-link:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>✓ Calendar Connected!</h1>
    <p>Redirecting back to Plantracker...</p>
    <p style="font-size: 12px; margin-top: 15px; opacity: 0.7;">
      If not redirected automatically
    </p>
    <a href="${deepLink}" class="manual-link">Click here to open app</a>
  </div>
  <script>
    // Attempt deep link redirect
    window.location.href = '${deepLink}';
    
    // Fallback: If still on this page after 2 seconds, show manual link
    setTimeout(function() {
      console.log('Auto-redirect completed');
    }, 2000);
  </script>
</body>
</html>
`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('status')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check Google Calendar integration status' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.googleAuthService.getIntegrationStatus(userId);
  }

  @Get('disconnect')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Google Calendar' })
  async disconnect(@CurrentUser('id') userId: string) {
    return this.googleAuthService.disconnect(userId);
  }
}
