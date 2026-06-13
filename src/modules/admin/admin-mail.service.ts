import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket, createConnection } from 'net';
import { TLSSocket, connect as connectTls } from 'tls';

interface MailConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

@Injectable()
export class AdminMailService {
  constructor(private readonly configService: ConfigService) {}

  async sendTotpCode(to: string, code: string): Promise<void> {
    const config = this.getConfig();
    const subject = 'AnonShare admin verification code';
    const text = [
      `Your AnonShare admin verification code is: ${code}`,
      '',
      'This code refreshes every 30 seconds. If you did not request it, ignore this email.',
    ].join('\n');

    await this.sendMail({
      config,
      to,
      subject,
      text,
    });
  }

  private getConfig(): MailConfig {
    const config = this.configService.get<MailConfig>('admin.mail');
    if (!config?.host || !config.user || !config.pass || !config.from) {
      throw new ServiceUnavailableException('Admin email delivery is not configured.');
    }
    return config;
  }

  private async sendMail(input: {
    config: MailConfig;
    to: string;
    subject: string;
    text: string;
  }): Promise<void> {
    const { config, to, subject, text } = input;
    let socket: Socket | TLSSocket = config.secure
      ? connectTls({ host: config.host, port: config.port, servername: config.host })
      : createConnection({ host: config.host, port: config.port });

    const read = this.createReader(socket);
    await read();
    await this.command(socket, read, `EHLO ${this.hostname()}`);

    if (!config.secure) {
      await this.command(socket, read, 'STARTTLS');
      socket = connectTls({ socket, servername: config.host });
      const tlsRead = this.createReader(socket);
      await this.command(socket, tlsRead, `EHLO ${this.hostname()}`);
      await this.authenticate(socket, tlsRead, config);
      await this.writeMessage(socket, tlsRead, config, to, subject, text);
      socket.end();
      return;
    }

    await this.authenticate(socket, read, config);
    await this.writeMessage(socket, read, config, to, subject, text);
    socket.end();
  }

  private async authenticate(
    socket: Socket | TLSSocket,
    read: () => Promise<string>,
    config: MailConfig,
  ): Promise<void> {
    await this.command(socket, read, 'AUTH LOGIN');
    await this.command(socket, read, Buffer.from(config.user ?? '').toString('base64'));
    await this.command(socket, read, Buffer.from(config.pass ?? '').toString('base64'));
  }

  private async writeMessage(
    socket: Socket | TLSSocket,
    read: () => Promise<string>,
    config: MailConfig,
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    await this.command(socket, read, `MAIL FROM:<${config.from}>`);
    await this.command(socket, read, `RCPT TO:<${to}>`);
    await this.command(socket, read, 'DATA');
    await this.command(
      socket,
      read,
      [
        `From: AnonShare Admin <${config.from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        text,
        '.',
      ].join('\r\n'),
    );
    await this.command(socket, read, 'QUIT', false);
  }

  private createReader(socket: Socket | TLSSocket): () => Promise<string> {
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
    });

    return () => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new ServiceUnavailableException('SMTP server did not respond.'));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('data', onData);
        socket.off('error', onError);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(new ServiceUnavailableException(error.message));
      };

      const onData = () => {
        if (!this.hasCompleteSmtpResponse(buffer)) return;
        const response = buffer;
        buffer = '';
        cleanup();
        resolve(response);
      };

      socket.on('data', onData);
      socket.on('error', onError);
      onData();
    });
  }

  private async command(
    socket: Socket | TLSSocket,
    read: () => Promise<string>,
    value: string,
    expectOk = true,
  ): Promise<string> {
    socket.write(`${value}\r\n`);
    const response = await read();
    if (expectOk && !/^[235]/.test(response)) {
      throw new ServiceUnavailableException('SMTP command failed.');
    }
    return response;
  }

  private hasCompleteSmtpResponse(response: string): boolean {
    const lines = response.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return false;
    const last = lines[lines.length - 1];
    return /^\d{3}\s/.test(last);
  }

  private hostname(): string {
    return 'anon-share.local';
  }
}
